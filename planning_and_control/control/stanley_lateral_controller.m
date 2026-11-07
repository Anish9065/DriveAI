%% stanley_lateral_controller.m
% Module #2: Vehicle Lateral Control
% Implements the Stanley Steering Control Law for robust path tracking.

function [steer_cmd, cross_track_err, yaw_err] = stanley_lateral_controller(ego_pose, traj, params)
    % Inputs:
    %   ego_pose : [x, y, yaw, v]
    %   traj     : struct with (x, y, yaw, v) of target trajectory
    %   params   : vehicle parameters (L, Lf, Stanley gains, limits)
    
    x = ego_pose(1);
    y = ego_pose(2);
    yaw = ego_pose(3);
    v = ego_pose(4);
    
    % 1. Compute Front Axle Position
    fx = x + params.Lf * cos(yaw);
    fy = y + params.Lf * sin(yaw);
    
    % 2. Find Nearest Trajectory Point to Front Axle
    dx = traj.x - fx;
    dy = traj.y - fy;
    dists = hypot(dx, dy);
    [~, min_idx] = min(dists);
    
    target_x   = traj.x(min_idx);
    target_y   = traj.y(min_idx);
    target_yaw = traj.yaw(min_idx);
    
    % 3. Compute Yaw Error (normalized to [-pi, pi])
    yaw_err = target_yaw - yaw;
    yaw_err = atan2(sin(yaw_err), cos(yaw_err));
    
    % 4. Compute Front-Axle Cross-Track Error
    % Vector from path to front axle
    vec_path_to_fa = [fx - target_x, fy - target_y];
    % Normal vector to target path (pointing to the left of path heading)
    normal_vec = [-sin(target_yaw), cos(target_yaw)];
    cross_track_err = dot(vec_path_to_fa, normal_vec);
    
    % 5. Stanley Steering Law
    % delta = yaw_err + atan2(k * e_fa, v + k_soft)
    steer_crosstrack = atan2(params.Stanley_k * cross_track_err, v + params.Stanley_k_soft);
    raw_steer = params.Stanley_k_yaw * yaw_err + steer_crosstrack;
    
    % 6. Saturate Steering Command within Physical Vehicle Limits
    steer_cmd = max(min(raw_steer, params.MaxSteerRad), -params.MaxSteerRad);
end
