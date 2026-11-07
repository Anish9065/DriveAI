%% vehicle_dynamic_bicycle_model.m
% Module #2: Vehicle Simulation
% Kinematic and Dynamic Bicycle Model state propagator.

function next_state = vehicle_dynamic_bicycle_model(current_state, steer_angle, accel, params)
    % Inputs:
    %   current_state : [x, y, yaw, v]
    %   steer_angle   : Front wheel steering angle (rad)
    %   accel         : Longitudinal acceleration (m/s^2)
    %   params        : Vehicle geometry
    
    x   = current_state(1);
    y   = current_state(2);
    yaw = current_state(3);
    v   = current_state(4);
    
    dt = params.dt;
    
    % Slip angle beta at center of gravity
    beta = atan2(params.Lr * tan(steer_angle), params.L);
    
    % Kinematic state derivatives
    x_dot   = v * cos(yaw + beta);
    y_dot   = v * sin(yaw + beta);
    yaw_dot = (v / params.L) * cos(beta) * tan(steer_angle);
    v_dot   = accel;
    
    % State update (Euler integration)
    next_x   = x + x_dot * dt;
    next_y   = y + y_dot * dt;
    next_yaw = yaw + yaw_dot * dt;
    next_v   = max(v + v_dot * dt, params.MinSpeed);
    
    % Normalize yaw to [-pi, pi]
    next_yaw = atan2(sin(next_yaw), cos(next_yaw));
    
    next_state = [next_x, next_y, next_yaw, next_v];
end
