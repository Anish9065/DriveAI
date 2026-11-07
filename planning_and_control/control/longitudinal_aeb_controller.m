%% longitudinal_aeb_controller.m
% Module #2: Vehicle Longitudinal Speed & Automatic Emergency Braking (AEB) Control
% Computes throttle [0, 1] or brake [0, 1] commands with safety override.

function [throttle_cmd, brake_cmd, aeb_triggered, pid_state] = longitudinal_aeb_controller(v_actual, v_target, min_front_dist, pid_state, params)
    % Inputs:
    %   v_actual       : Current vehicle speed (m/s)
    %   v_target       : Desired target speed from trajectory planner (m/s)
    %   min_front_dist : Distance to closest obstacle directly ahead (m)
    %   pid_state      : struct holding integrator and previous error
    %   params         : Vehicle & PID parameters
    
    % --- 1. Automatic Emergency Braking (AEB) Check ---
    % Time To Collision (TTC) = distance / relative speed
    ttc = inf;
    if v_actual > 0.5 && ~isinf(min_front_dist)
        ttc = min_front_dist / v_actual;
    end
    
    % Trigger AEB if distance < 4.0m or TTC < 1.4s
    if (min_front_dist < 4.0) || (ttc < 1.4 && min_front_dist < 12.0)
        aeb_triggered = true;
        throttle_cmd = 0.0;
        brake_cmd = 1.0; % 100% Full Emergency Braking
        pid_state.integral = 0.0;
        return;
    else
        aeb_triggered = false;
    end
    
    % --- 2. PID Velocity Tracking ---
    speed_error = v_target - v_actual;
    
    % Integral with anti-windup
    pid_state.integral = pid_state.integral + speed_error * params.dt;
    pid_state.integral = max(min(pid_state.integral, 5.0), -5.0);
    
    % Derivative
    deriv = (speed_error - pid_state.prev_error) / params.dt;
    pid_state.prev_error = speed_error;
    
    % Control effort (desired acceleration in m/s^2)
    accel_cmd = params.PID_Kp * speed_error + ...
                params.PID_Ki * pid_state.integral + ...
                params.PID_Kd * deriv;
            
    % Limit acceleration to comfort band
    accel_cmd = max(min(accel_cmd, params.MaxAccel), params.MaxDecel);
    
    % --- 3. Map Acceleration to Throttle and Brake Pedals ---
    if accel_cmd >= 0
        throttle_cmd = accel_cmd / params.MaxAccel;
        brake_cmd = 0.0;
    else
        throttle_cmd = 0.0;
        brake_cmd = abs(accel_cmd) / abs(params.MaxDecel);
    end
    
    throttle_cmd = max(min(throttle_cmd, 1.0), 0.0);
    brake_cmd    = max(min(brake_cmd, 1.0), 0.0);
end
