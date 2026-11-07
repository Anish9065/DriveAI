%% build_simulink_model.m
% Module #2: Programmatic Simulink Architecture Builder
% Creates and configures the 'autonomous_vehicle_control_system.slx' model.

clear; clc;
fprintf('=================================================================\n');
fprintf('     BUILDING PROGRAMMATIC SIMULINK CONTROL ARCHITECTURE         \n');
fprintf('=================================================================\n\n');

% 1. Initialize Base Workspace
load_simulink_workspace;

modelName = 'autonomous_vehicle_control_system';
close_system(modelName, 0);

% 2. Create New System
fprintf('1. Creating Simulink model: %s.slx...\n', modelName);
new_system(modelName);
open_system(modelName);

% Set solver settings for 20 Hz discrete/continuous vehicle control
set_param(modelName, 'Solver', 'ode4', 'FixedStep', '0.05', 'StopTime', '18.0');

% 3. Add Core Subsystems
% A. Reference State Generator
add_block('simulink/Sources/Constant', [modelName, '/TargetSpeed_kmh'], ...
          'Position', [60, 80, 160, 110], 'Value', '30.0');

% B. Trajectory & Controller MATLAB Function Blocks
add_block('simulink/User-Defined Functions/MATLAB Function', [modelName, '/Stanley_Steering_Controller'], ...
          'Position', [260, 60, 480, 160]);

% C. Vehicle Dynamic Plant Block
add_block('simulink/User-Defined Functions/MATLAB Function', [modelName, '/Vehicle_Dynamics_Plant'], ...
          'Position', [560, 80, 780, 200]);

% D. Telemetry Scopes
add_block('simulink/Sinks/Scope', [modelName, '/Vehicle_Telemetry_Scope'], ...
          'Position', [860, 90, 920, 150]);

fprintf('2. Blocks added to canvas successfully.\n');

% 4. Save Model
save_system(modelName, fullfile('c:', 'Users', 'narut', 'OneDrive', 'Desktop', 'sih', 'planning_and_control', 'simulink', [modelName, '.slx']));
fprintf('3. [SUCCESS] Model saved as: %s.slx\n\n', fullfile('c:', 'Users', 'narut', 'OneDrive', 'Desktop', 'sih', 'planning_and_control', 'simulink', modelName));
fprintf('=================================================================\n');
