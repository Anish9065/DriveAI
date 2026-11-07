function tracker = setup_tracker_gnn()
% SETUP_TRACKER_GNN Initializes a Global Nearest Neighbor multi-object tracker
% Configured for Indian road autonomous vehicle perception.
%
% Output:
%   tracker - trackerGNN object configured with 3D Constant Velocity Kalman Filter

tracker = trackerGNN(...
    'FilterInitializationFcn', @initConstantVelocityFilter, ...
    'AssignmentThreshold', 35.0, ...            % Gate threshold (Mahalanobis distance)
    'ConfirmationThreshold', [2 3], ...          % Confirm track if detected in 2 out of 3 frames
    'DeletionThreshold', [4 5], ...              % Delete track if missed in 4 out of 5 frames
    'MaxNumTracks', 100, ...                     % High track capacity for dense traffic
    'MaxNumSensors', 3);                         % Camera (1), Radar (2), LiDAR (3)

fprintf('[OK] trackerGNN initialized with 3D constant velocity motion model.\n');
end

function filter = initConstantVelocityFilter(detection)
% Kalman Filter initialization for 3D state: [x; vx; y; vy; z; vz]
% Measurement is 3D position [x; y; z] in ego vehicle coordinate frame

measurement = detection.Measurement; % [x; y; z]

% Initial State: [x; 0; y; 0; z; 0]
state = [measurement(1); 0; measurement(2); 0; measurement(3); 0];

% Initial State Covariance
stateCov = diag([1.5, 9.0, 1.5, 9.0, 0.5, 4.0]);

% Process Noise: [Q_x, Q_y, Q_z]
processNoise = diag([1.0, 1.0, 0.2]);

filter = trackingKF(...
    'MotionModel', '3D Constant Velocity', ...
    'State', state, ...
    'StateCovariance', stateCov, ...
    'ProcessNoise', processNoise, ...
    'MeasurementNoise', detection.MeasurementNoise);
end
