%% vehicle_params.m
% Module #2: Planning & Control Subsystem
% Defines physical and dynamic vehicle parameters for autonomous passenger vehicle.

function params = vehicle_params()
    params = struct();
    
    % --- Vehicle Geometry ---
    params.L        = 2.6;       % Wheelbase (m)
    params.Lf       = 1.2;       % Distance from CG to front axle (m)
    params.Lr       = 1.4;       % Distance from CG to rear axle (m)
    params.Width    = 1.8;       % Total vehicle width (m)
    params.Length   = 4.0;       % Total vehicle length (m)
    params.SafetyRadius = 1.3;   % Safety bounding circle radius (m)

    % --- Mass & Inertia ---
    params.Mass     = 1400.0;    % Vehicle curb mass (kg)
    params.Iz       = 2200.0;    % Yaw moment of inertia (kg*m^2)
    params.Cf       = 85000.0;   % Front axle cornering stiffness (N/rad)
    params.Cr       = 85000.0;   % Rear axle cornering stiffness (N/rad)

    % --- Actuator Limits ---
    params.MaxSteerDeg   = 35.0;     % Maximum steering angle (+/- deg)
    params.MaxSteerRad   = deg2rad(params.MaxSteerDeg);
    params.MaxSteerRate  = deg2rad(25.0); % Max steering rate (rad/s)
    params.MaxAccel      = 3.0;      % Maximum comfort acceleration (m/s^2)
    params.MaxDecel      = -4.0;     % Maximum comfort deceleration (m/s^2)
    params.EmergencyDecel= -7.5;     % AEB Emergency braking deceleration (m/s^2)

    % --- Speed Goals ---
    params.TargetSpeedUrban  = 8.33;  % 30 km/h in m/s (Urban Indian road)
    params.TargetSpeedHigh   = 13.88; % 50 km/h in m/s (Arterial corridor)
    params.MinSpeed          = 0.0;   % Full stop

    % --- Controller Gains ---
    % Stanley Steering
    params.Stanley_k         = 0.75;  % Cross-track error gain
    params.Stanley_k_soft    = 1.0;   % Softening velocity parameter (m/s)
    params.Stanley_k_yaw     = 1.2;   % Yaw error compensation gain
    
    % Longitudinal PID
    params.PID_Kp            = 0.85;  % Proportional gain
    params.PID_Ki            = 0.15;  % Integral gain
    params.PID_Kd            = 0.05;  % Derivative gain

    % Time Step
    params.dt                = 0.05;  % 20 Hz control loop
end
