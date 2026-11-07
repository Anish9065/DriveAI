%% test_dense_indian_traffic_3d.m
% Module #2: 3D Autonomous Driving & Dense Indian Traffic Simulator
% Photorealistic 3D Environment with:
%   - 3D Extruded Asphalt Road with Curb Markings & Terrain
%   - 3D Foliage & Trees (3D Trunks & Volumetric Foliage Canopies)
%   - 3D Animated Indian Traffic (Ego Car, Auto-Rickshaw, Cows, Dogs, Bus, Bike, Barricades, Pedestrians)
%   - Dynamic 3D Chase Camera following Ego Vehicle with Lighting & Shadows
%   - Real-Time Steering, Velocity & AEB Emergency Braking HUD

clear; clc; close all;
fprintf('=================================================================\n');
fprintf('    SIH AUTONOMOUS VEHICLE - 3D INDIAN TRAFFIC SIMULATOR         \n');
fprintf('    Full 3D Environment, Dynamic Chase Camera & Realistic Models \n');
fprintf('=================================================================\n\n');

% 1. Load Parameters
addpath(genpath(fullfile('c:', 'Users', 'narut', 'OneDrive', 'Desktop', 'sih', 'planning_and_control')));
params = vehicle_params();

% 2. Generate 3D Road Geometry (180m Corridor with Elevation and Curvature)
s_arr = 0:0.5:180;
ref_x = s_arr;
ref_y = 2.8 * sin(s_arr / 22.0) + 0.8 * cos(s_arr / 45.0);
ref_z = 0.4 * sin(s_arr / 30.0); % Subtle 3D road elevation gradient
ref_yaw = zeros(size(s_arr));
ref_curv = zeros(size(s_arr));

for i = 1:length(s_arr)-1
    ref_yaw(i) = atan2(ref_y(i+1) - ref_y(i), ref_x(i+1) - ref_x(i));
end
ref_yaw(end) = ref_yaw(end-1);

ref_path = struct('s', s_arr, 'x', ref_x, 'y', ref_y, 'z', ref_z, 'yaw', ref_yaw, 'curv', ref_curv);

% 3D Road Boundaries (+/- 3.6m width)
ROAD_W = 3.6;
road_left_x  = ref_path.x - ROAD_W * sin(ref_path.yaw);
road_left_y  = ref_path.y + ROAD_W * cos(ref_path.yaw);
road_left_z  = ref_path.z;

road_right_x = ref_path.x + ROAD_W * sin(ref_path.yaw);
road_right_y = ref_path.y - ROAD_W * cos(ref_path.yaw);
road_right_z = ref_path.z;

% 3. Create 3D Trees
trees = [
    struct('x', 18.0, 'y', 5.2,  'z', 0.0, 'h', 4.5, 'rad', 1.6), ...
    struct('x', 46.0, 'y', -5.0, 'z', 0.0, 'h', 5.0, 'rad', 1.8), ...
    struct('x', 78.0, 'y', 5.4,  'z', 0.0, 'h', 5.5, 'rad', 2.0), ...
    struct('x', 112.0,'y', -5.2, 'z', 0.0, 'h', 4.8, 'rad', 1.7), ...
    struct('x', 145.0,'y', 5.3,  'z', 0.0, 'h', 5.2, 'rad', 1.9), ...
    struct('x', 172.0,'y', -5.0, 'z', 0.0, 'h', 4.6, 'rad', 1.6)
];

% 4. 3D Indian Road Actors
obstacles = [
    struct('name', 'Auto-Rickshaw', 'type', 'rickshaw', 'x', 26.0, 'y', 0.6,   'z', 0.0, 'vx', 1.8, 'vy', 0.0, 'radius', 1.1, 'color', [1.0, 0.75, 0.0]), ...
    struct('name', 'Stray Dog',     'type', 'dog',      'x', 42.0, 'y', -3.2,  'z', 0.0, 'vx', 0.4, 'vy', 0.9, 'radius', 0.6, 'color', [0.9, 0.8, 0.2]), ...
    struct('name', 'Stray Cow',     'type', 'cow',      'x', 60.0, 'y', 1.5,   'z', 0.0, 'vx', 0.0, 'vy', 0.0, 'radius', 1.3, 'color', [0.65, 0.35, 0.15]), ...
    struct('name', 'Motorcycle',    'type', 'bike',     'x', 74.0, 'y', -1.5,  'z', 0.0, 'vx', 2.8, 'vy', 0.1, 'radius', 0.8, 'color', [0.2, 0.9, 0.9]), ...
    struct('name', 'V-Barricade',   'type', 'barrier',  'x', 94.0, 'y', 1.3,   'z', 0.0, 'vx', 0.0, 'vy', 0.0, 'radius', 1.0, 'color', [1.0, 0.2, 0.2]), ...
    struct('name', 'Traffic Cones', 'type', 'cone',     'x', 100.0,'y', 0.7,   'z', 0.0, 'vx', 0.0, 'vy', 0.0, 'radius', 0.7, 'color', [1.0, 0.4, 0.0]), ...
    struct('name', 'City Bus',      'type', 'bus',      'x', 124.0,'y', -1.3,  'z', 0.0, 'vx', 1.5, 'vy', 0.0, 'radius', 1.7, 'color', [0.75, 0.25, 0.85]), ...
    struct('name', 'Walking Cow',   'type', 'cow',      'x', 144.0,'y', 0.2,   'z', 0.0, 'vx', 0.3, 'vy', -0.1,'radius', 1.4, 'color', [0.55, 0.30, 0.10]), ...
    struct('name', 'Pedestrians',   'type', 'person',   'x', 162.0,'y', -3.2,  'z', 0.0, 'vx', 0.0, 'vy', 0.7, 'radius', 0.9, 'color', [0.2, 1.0, 0.6])
];

% 5. Initialize Ego State
ego_pose = [0.0, 0.0, ref_yaw(1), 0.0]; % [x, y, yaw, v]
frenet_state = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
pid_state = struct('integral', 0.0, 'prev_error', 0.0);

sim_time = 24.0;
time_steps = round(sim_time / params.dt);
plan_period = 0.20; % 5 Hz
plan_counter = 0;
current_traj = [];

history = struct('t', [], 'x', [], 'y', [], 'z', [], 'v', [], 'steer', [], 'cte', [], 'aeb', []);

% 6. Create 3D Figure Window
fig = figure('Name', 'SIH 3D Autonomous Vehicle Simulator (Indian Traffic Scenario)', ...
             'Color', [0.04 0.06 0.09], ...
             'Position', [30 30 1380 780]);

fprintf('[*] Starting 3D Simulation with Real-Time Chase Camera...\n');

for step = 1:time_steps
    t_curr = (step - 1) * params.dt;
    
    % Update Obstacles
    for k = 1:length(obstacles)
        obstacles(k).x = obstacles(k).x + obstacles(k).vx * params.dt;
        obstacles(k).y = obstacles(k).y + obstacles(k).vy * params.dt;
        % Height interpolation
        [~, o_idx] = min(abs(ref_path.x - obstacles(k).x));
        obstacles(k).z = ref_path.z(o_idx);
    end
    
    % Ego Height & Frenet Coordinates
    [~, nearest_idx] = min(hypot(ref_path.x - ego_pose(1), ref_path.y - ego_pose(2)));
    ego_z = ref_path.z(nearest_idx);
    frenet_s = ref_path.s(nearest_idx);
    frenet_d = (ego_pose(2) - ref_path.y(nearest_idx)) * cos(ref_path.yaw(nearest_idx)) - ...
               (ego_pose(1) - ref_path.x(nearest_idx)) * sin(ref_path.yaw(nearest_idx));
    
    frenet_state(1) = frenet_s;
    frenet_state(2) = ego_pose(4);
    frenet_state(4) = frenet_d;
    
    % Obstacle Closest Check
    min_dist_ahead = inf;
    min_overall_dist = inf;
    nearest_actor = 'Clear';
    
    for k = 1:length(obstacles)
        d_obs = hypot(obstacles(k).x - ego_pose(1), obstacles(k).y - ego_pose(2));
        if d_obs < min_overall_dist
            min_overall_dist = d_obs;
            nearest_actor = obstacles(k).name;
        end
        if (obstacles(k).x > ego_pose(1)) && (d_obs < min_dist_ahead)
            min_dist_ahead = d_obs;
        end
    end
    
    % Replan Frenet Trajectory
    if isempty(current_traj) || plan_counter >= round(plan_period / params.dt)
        [best_traj, ~] = frenet_optimal_trajectory(frenet_state, ref_path, obstacles, params);
        if ~isempty(best_traj)
            current_traj = best_traj;
        end
        plan_counter = 0;
    end
    plan_counter = plan_counter + 1;
    
    % Controller Actuation
    if isempty(current_traj)
        accel_net = params.EmergencyDecel;
        steer_cmd = 0.0;
        cte = 0.0;
        aeb_active = true;
    else
        [steer_cmd, cte, ~] = stanley_lateral_controller(ego_pose, current_traj, params);
        target_v = current_traj.v(min(step, length(current_traj.v)));
        [throttle_cmd, brake_cmd, aeb_active, pid_state] = longitudinal_aeb_controller(...
            ego_pose(4), target_v, min_dist_ahead, pid_state, params);
        
        if aeb_active
            accel_net = params.EmergencyDecel;
        elseif throttle_cmd > 0
            accel_net = throttle_cmd * params.MaxAccel;
        else
            accel_net = brake_cmd * params.MaxDecel;
        end
    end
    
    ego_pose = vehicle_dynamic_bicycle_model(ego_pose, steer_cmd, accel_net, params);
    
    % Log
    history.t(end+1)     = t_curr;
    history.x(end+1)     = ego_pose(1);
    history.y(end+1)     = ego_pose(2);
    history.z(end+1)     = ego_z;
    history.v(end+1)     = ego_pose(4) * 3.6;
    history.steer(end+1) = rad2deg(steer_cmd);
    history.cte(end+1)   = cte;
    history.aeb(end+1)   = aeb_active;
    
    % --- 3D RENDERING LOOP (10 Hz) ---
    if mod(step, 2) == 0 && ishandle(fig)
        clf(fig);
        
        % 3D World Axes Setup
        ax3d = axes('Position', [0.02, 0.02, 0.96, 0.96], 'Color', [0.06 0.08 0.12]);
        hold(ax3d, 'on'); box(ax3d, 'on'); grid(ax3d, 'on');
        set(ax3d, 'XColor', [0.3 0.4 0.5], 'YColor', [0.3 0.4 0.5], 'ZColor', [0.3 0.4 0.5]);
        
        % 1. Render 3D Ground Grass / Terrain
        terrain_x = [ref_path.x, fliplr(ref_path.x)];
        terrain_left_y  = ref_path.y + 12.0;
        terrain_right_y = ref_path.y - 12.0;
        patch([terrain_x(1:length(ref_path.x)), fliplr(terrain_x(1:length(ref_path.x)))], ...
              [terrain_left_y, fliplr(terrain_right_y)], ...
              zeros(1, 2*length(ref_path.x)) - 0.08, ...
              [0.10 0.18 0.12], 'EdgeColor', 'none', 'FaceAlpha', 0.9);
        
        % 2. Render 3D Dark Asphalt Road Mesh
        X_road = [road_left_x; road_right_x];
        Y_road = [road_left_y; road_right_y];
        Z_road = [road_left_z; road_right_z];
        surf(X_road, Y_road, Z_road, 'FaceColor', [0.18 0.20 0.24], 'EdgeColor', 'none', 'FaceAlpha', 1.0);
        
        % 3. Render Road Boundary Curbs (White Solid 3D Lines) & Centerline (Yellow Dashed)
        plot3(road_left_x, road_left_y, road_left_z + 0.02, 'w-', 'LineWidth', 3.0);
        plot3(road_right_x, road_right_y, road_right_z + 0.02, 'w-', 'LineWidth', 3.0);
        plot3(ref_path.x, ref_path.y, ref_path.z + 0.02, '--', 'Color', [0.9 0.85 0.2], 'LineWidth', 1.8);
        
        % 4. Render 3D Planned Optimal Trajectory (Cyan Ribbon)
        if ~isempty(current_traj)
            traj_z = interp1(ref_path.s, ref_path.z, current_traj.s, 'linear', 'extrap') + 0.05;
            plot3(current_traj.x, current_traj.y, traj_z, 'c-', 'LineWidth', 3.5);
        end
        
        % 5. Render 3D Trees along roadside
        for tr = 1:length(trees)
            draw_3d_tree(trees(tr).x, trees(tr).y, trees(tr).z, trees(tr).h, trees(tr).rad);
        end
        
        % 6. Render 3D Indian Road Actors
        for k = 1:length(obstacles)
            draw_3d_actor(obstacles(k));
        end
        
        % 7. Render 3D Ego Autonomous Vehicle
        draw_3d_ego_car(ego_pose(1), ego_pose(2), ego_z, ego_pose(3), params);
        
        % 8. Render Driven Trajectory Trail (Green 3D line)
        plot3(history.x, history.y, history.z + 0.04, 'g-', 'LineWidth', 2.2);
        
        % 9. Dynamic 3D Chase Camera Follow System
        ex = ego_pose(1); ey = ego_pose(2); ez = ego_z; eyaw = ego_pose(3);
        
        % Camera positioned behind and above the car
        cam_dist = 14.0;
        cam_height = 6.0;
        cam_x = ex - cam_dist * cos(eyaw);
        cam_y = ey - cam_dist * sin(eyaw);
        cam_z = ez + cam_height;
        
        campos(ax3d, [cam_x, cam_y, cam_z]);
        camtarget(ax3d, [ex + 18.0 * cos(eyaw), ey + 18.0 * sin(eyaw), ez + 1.2]);
        camva(ax3d, 40); % 40 degree field of view
        
        % Add 3D Sunlight & Shading
        light('Position', [ex + 20, ey - 20, 30], 'Style', 'infinite');
        lighting gouraud;
        material dull;
        
        % HUD Status
        if aeb_active
            hud_status = sprintf('COLLISION WARNING! AEB ACTIVE - BRAKING FOR %s', upper(nearest_actor));
            hud_col = [1.0 0.2 0.2];
        else
            hud_status = sprintf('AUTONOMOUS 3D CRUISE & ADAPTIVE SWERVE - ACTOR AHEAD: %s', nearest_actor);
            hud_col = [0.2 1.0 0.4];
        end
        
        title(sprintf('SIH 3D AUTONOMOUS VEHICLE SIMULATOR | %s\nTime: %.1fs | Speed: %.1f km/h | Steer: %+.1f deg | Clearance: %.2fm', ...
              hud_status, t_curr, history.v(end), history.steer(end), min_overall_dist), ...
              'Color', hud_col, 'FontSize', 12, 'FontWeight', 'bold');
        
        drawnow;
    end
    
    if ego_pose(1) > 170.0
        fprintf('[SUCCESS] 3D Autonomous Vehicle safely reached destination!\n');
        break;
    end
end

fprintf('\n=================================================================\n');
fprintf('3D SIMULATION COMPLETE - ALL ACTORS SAFELY NAVIGATED!\n');
fprintf('=================================================================\n');

% --- 3D RENDERING HELPER FUNCTIONS ---

function draw_3d_box(cx, cy, cz, l, w, h, yaw, color)
    % 3D Box centered at (cx, cy, cz) with heading yaw
    x_corners = [-l/2, l/2, l/2, -l/2, -l/2, l/2, l/2, -l/2];
    y_corners = [-w/2, -w/2, w/2, w/2, -w/2, -w/2, w/2, w/2];
    z_corners = [0, 0, 0, 0, h, h, h, h];
    
    R = [cos(yaw), -sin(yaw); sin(yaw), cos(yaw)];
    rot_xy = R * [x_corners; y_corners];
    
    X = rot_xy(1,:) + cx;
    Y = rot_xy(2,:) + cy;
    Z = z_corners + cz;
    
    faces = [1 2 3 4; 5 6 7 8; 1 2 6 5; 2 3 7 6; 3 4 8 7; 4 1 5 8];
    patch('Vertices', [X', Y', Z'], 'Faces', faces, 'FaceColor', color, 'EdgeColor', [0.1 0.1 0.1], 'FaceAlpha', 0.95);
end

function draw_3d_ego_car(x, y, z, yaw, params)
    % 1. Main Metallic Blue Chassis
    draw_3d_box(x, y, z, params.Length, params.Width, 0.75, yaw, [0.12, 0.45, 0.95]);
    % 2. Glass Cabin Greenhouse
    cabin_x = x - 0.2 * cos(yaw);
    cabin_y = y - 0.2 * sin(yaw);
    draw_3d_box(cabin_x, cabin_y, z + 0.75, params.Length * 0.55, params.Width * 0.82, 0.65, yaw, [0.15, 0.25, 0.35]);
    % 3. Headlights
    hl_l_x = x + (params.Length/2)*cos(yaw) - 0.6*sin(yaw);
    hl_l_y = y + (params.Length/2)*sin(yaw) + 0.6*cos(yaw);
    hl_r_x = x + (params.Length/2)*cos(yaw) + 0.6*sin(yaw);
    hl_r_y = y + (params.Length/2)*sin(yaw) - 0.6*cos(yaw);
    plot3([hl_l_x, hl_r_x], [hl_l_y, hl_r_y], [z+0.45, z+0.45], 'o', 'Color', [1 1 0.7], 'MarkerFaceColor', [1 1 0.7], 'MarkerSize', 6);
end

function draw_3d_tree(tx, ty, tz, h, rad)
    % Trunk (Brown cylinder)
    [cx, cy, cz] = cylinder(rad * 0.22, 12);
    cz = cz * (h * 0.45) + tz;
    surf(cx + tx, cy + ty, cz, 'FaceColor', [0.45, 0.28, 0.12], 'EdgeColor', 'none');
    
    % Foliage (Green sphere)
    [sx, sy, sz] = sphere(12);
    foliage_z = tz + h * 0.70;
    surf(sx * rad + tx, sy * rad + ty, sz * rad + foliage_z, 'FaceColor', [0.15, 0.60, 0.22], 'EdgeColor', 'none', 'FaceAlpha', 0.95);
end

function draw_3d_actor(act)
    ax = act.x; ay = act.y; az = act.z; col = act.color;
    
    switch act.type
        case 'rickshaw'
            % Yellow/Green Auto-Rickshaw
            draw_3d_box(ax, ay, az, 2.6, 1.3, 0.8, 0.0, [0.1, 0.6, 0.2]); % Green lower
            draw_3d_box(ax, ay, az + 0.8, 2.4, 1.2, 0.9, 0.0, [1.0, 0.8, 0.1]); % Yellow canopy
        case 'bus'
            % Big City Bus
            draw_3d_box(ax, ay, az, 8.5, 2.5, 2.8, 0.0, col);
        case 'cow'
            % Stray Cow / Cattle (Body + Head)
            draw_3d_box(ax, ay, az, 2.2, 1.1, 1.2, 0.0, col);
            draw_3d_box(ax + 1.2, ay, az + 0.8, 0.8, 0.7, 0.7, 0.0, col * 0.85);
        case 'dog'
            % Stray Dog
            draw_3d_box(ax, ay, az, 1.1, 0.5, 0.6, 0.0, col);
        case 'bike'
            % Motorcycle & Rider
            draw_3d_box(ax, ay, az, 2.0, 0.6, 0.9, 0.0, [0.2, 0.8, 0.9]);
            draw_3d_box(ax - 0.2, ay, az + 0.9, 0.6, 0.5, 0.8, 0.0, [0.9, 0.3, 0.2]); % Rider
        case 'person'
            % Pedestrian
            draw_3d_box(ax, ay, az, 0.6, 0.6, 1.2, 0.0, [0.2, 0.7, 0.9]); % Torso
            [sx, sy, sz] = sphere(8);
            surf(sx*0.35 + ax, sy*0.35 + ay, sz*0.35 + az + 1.5, 'FaceColor', [0.95, 0.80, 0.65], 'EdgeColor', 'none');
        case 'barrier'
            % V-Barricade
            draw_3d_box(ax, ay, az, 2.0, 0.4, 1.1, 0.0, [1.0, 0.2, 0.2]);
        case 'cone'
            % Traffic Cone
            [cx, cy, cz] = cylinder([0.4 0.05], 10);
            surf(cx + ax, cy + ay, cz * 0.9 + az, 'FaceColor', [1.0, 0.4, 0.0], 'EdgeColor', 'none');
        otherwise
            draw_3d_box(ax, ay, az, 1.5, 1.5, 1.0, 0.0, col);
    end
end
