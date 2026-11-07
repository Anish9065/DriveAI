%% frenet_optimal_trajectory.m
% Module #2: Trajectory Planning Subsystem
% Generates jerk-optimal, collision-free spatiotemporal Frenet trajectories
% Enforces STRICT ROAD BOUNDARY LIMITS (Vehicle footprint never crosses road edges).

function [best_traj, all_trajs] = frenet_optimal_trajectory(ego_state, ref_path, obstacles, params)
    % Inputs:
    %   ego_state : [s, s_d, s_dd, d, d_d, d_dd] in Frenet frame
    %   ref_path  : struct with (x, y, s, yaw, kappa) of road centerline
    %   obstacles : Array of struct with [x, y, vx, vy, radius]
    %   params    : vehicle parameters
    
    % Cost weights
    K_JERK_LAT = 0.1;
    K_TIME     = 0.1;
    K_DIFF_D   = 1.0;
    K_DIFF_V   = 1.5;
    
    % Strict Road Geometrical Constraints
    ROAD_HALF_WIDTH   = 3.5; % Total road width = 7.0m (+/- 3.5m from center)
    VEH_HALF_WIDTH    = params.Width / 2.0; % 0.9m
    SAFETY_MARGIN     = 0.25; % 0.25m buffer from road edge curb
    
    % Maximum safe lateral position for vehicle centerline
    MAX_SAFE_D_L = ROAD_HALF_WIDTH - VEH_HALF_WIDTH - SAFETY_MARGIN; % +2.35m
    MAX_SAFE_D_R = -(ROAD_HALF_WIDTH - VEH_HALF_WIDTH - SAFETY_MARGIN); % -2.35m
    D_ROAD_W     = 0.40; % Lateral sampling step (m)
    
    MIN_T = 2.5;  % Planning time horizon min (s)
    MAX_T = 4.5;  % Planning time horizon max (s)
    DT_T  = 0.5;  % Horizon step (s)
    
    target_v = params.TargetSpeedUrban;
    
    all_trajs = {};
    best_traj = [];
    min_cost = inf;
    
    s_0   = ego_state(1);
    s_d_0 = ego_state(2);
    s_dd_0= ego_state(3);
    
    d_0   = ego_state(4);
    d_d_0 = ego_state(5);
    d_dd_0= ego_state(6);
    
    % Also include target_v = 0 (Stop trajectory) in case the road is fully blocked
    target_speeds = [target_v, target_v * 0.5, 0.0];
    
    % Sample lateral target positions d_T strictly within road boundary
    for d_T = MAX_SAFE_D_R : D_ROAD_W : MAX_SAFE_D_L
        for v_cand = target_speeds
            for Ti = MIN_T : DT_T : MAX_T
                traj = struct();
                traj.Ti = Ti;
                traj.t = 0 : params.dt : Ti;
                
                % --- Lateral Quintic Polynomial ---
                a0 = d_0;
                a1 = d_d_0;
                a2 = 0.5 * d_dd_0;
                
                A_mat = [Ti^3,     Ti^4,      Ti^5;
                         3*Ti^2,   4*Ti^3,    5*Ti^4;
                         6*Ti,     12*Ti^2,   20*Ti^3];
                B_vec = [d_T - a0 - a1*Ti - a2*Ti^2;
                         0   - a1 - 2*a2*Ti;
                         0   - 2*a2];
                
                a_lat = A_mat \ B_vec;
                a3 = a_lat(1); a4 = a_lat(2); a5 = a_lat(3);
                
                traj.d    = a0 + a1*traj.t + a2*traj.t.^2 + a3*traj.t.^3 + a4*traj.t.^4 + a5*traj.t.^5;
                traj.d_d  = a1 + 2*a2*traj.t + 3*a3*traj.t.^2 + 4*a4*traj.t.^3 + 5*a5*traj.t.^4;
                traj.d_dd = 2*a2 + 6*a3*traj.t + 12*a4*traj.t.^2 + 20*a5*traj.t.^3;
                traj.d_ddd= 6*a3 + 24*a4*traj.t + 60*a5*traj.t.^2;
                
                % Check if any point of vehicle footprint exceeds road boundary
                if any(abs(traj.d) + VEH_HALF_WIDTH > (ROAD_HALF_WIDTH - 0.05))
                    continue; % Hard rejection: NEVER go beyond road!
                end
                
                % --- Longitudinal Quartic Polynomial for Velocity Keeping ---
                b0 = s_d_0;
                b1 = s_dd_0;
                A_lon = [Ti^2,   Ti^3;
                         2*Ti,   3*Ti^2];
                B_lon = [v_cand - b0 - b1*Ti;
                         0      - b1];
                b_lon = A_lon \ B_lon;
                b2 = b_lon(1); b3 = b_lon(2);
                
                traj.s_d  = b0 + b1*traj.t + b2*traj.t.^2 + b3*traj.t.^3;
                traj.s_dd = b1 + 2*b2*traj.t + 3*b3*traj.t.^2;
                traj.s_ddd= 2*b2 + 6*b3*traj.t;
                traj.s    = s_0 + cumtrapz(traj.t, traj.s_d);
                
                % Convert Frenet to Cartesian Coordinates
                [traj.x, traj.y, traj.yaw, traj.v, traj.curv, valid] = frenet_to_cartesian(traj, ref_path);
                if ~valid
                    continue;
                end
                
                % Cost calculation
                J_lat_jerk   = sum(traj.d_ddd.^2) * params.dt;
                J_lon_jerk   = sum(traj.s_ddd.^2) * params.dt;
                J_lat_diff   = (traj.d(end))^2;
                J_speed_diff = (traj.s_d(end) - target_v)^2;
                
                % Collision Risk Check with all obstacles
                [has_collision, min_dist] = check_collision(traj, obstacles, params.SafetyRadius);
                
                if has_collision
                    traj.cost = inf;
                else
                    traj.cost = K_JERK_LAT * J_lat_jerk + ...
                                K_JERK_LAT * J_lon_jerk + ...
                                K_TIME * Ti + ...
                                K_DIFF_D * J_lat_diff + ...
                                K_DIFF_V * J_speed_diff + ...
                                (1.0 / (min_dist + 1e-3)) * 4.0;
                end
                
                all_trajs{end+1} = traj; %#ok<AGROW>
                
                if traj.cost < min_cost
                    min_cost = traj.cost;
                    best_traj = traj;
                end
            end
        end
    end
end

% --- Helper: Frenet to Cartesian Mapping ---
function [x, y, yaw, v, curv, valid] = frenet_to_cartesian(traj, ref_path)
    N = length(traj.t);
    x = zeros(1, N);
    y = zeros(1, N);
    yaw = zeros(1, N);
    v = zeros(1, N);
    curv = zeros(1, N);
    valid = true;
    
    for i = 1:N
        s_val = traj.s(i);
        d_val = traj.d(i);
        
        if s_val < ref_path.s(1) || s_val > ref_path.s(end)
            valid = false;
            return;
        end
        
        rx = interp1(ref_path.s, ref_path.x, s_val, 'spline');
        ry = interp1(ref_path.s, ref_path.y, s_val, 'spline');
        ryaw = interp1(ref_path.s, ref_path.yaw, s_val, 'spline');
        rcurv = interp1(ref_path.s, ref_path.curv, s_val, 'spline');
        
        x(i) = rx - d_val * sin(ryaw);
        y(i) = ry + d_val * cos(ryaw);
        yaw(i) = ryaw + atan2(traj.d_d(i), traj.s_d(i));
        v(i) = sqrt(traj.s_d(i)^2 + traj.d_d(i)^2);
        curv(i) = rcurv;
    end
end

% --- Helper: Collision Verification ---
function [has_collision, min_dist] = check_collision(traj, obstacles, safety_radius)
    has_collision = false;
    min_dist = inf;
    
    if isempty(obstacles)
        return;
    end
    
    for i = 1:length(traj.x)
        px = traj.x(i);
        py = traj.y(i);
        
        for k = 1:length(obstacles)
            ox = obstacles(k).x;
            oy = obstacles(k).y;
            orad = obstacles(k).radius;
            
            dist = hypot(px - ox, py - oy);
            if dist < min_dist
                min_dist = dist;
            end
            
            if dist < (safety_radius + orad)
                has_collision = true;
                return;
            end
        end
    end
end
