%% load_simulink_workspace.m
% Module #2: Simulink Workspace Initializer
% Prepares Base Workspace bus signals, vehicle parameters, and scenario inputs
% for Simulink autonomous control models.

clear; clc;
fprintf('=================================================================\n');
fprintf('     INITIALIZING SIMULINK WORKSPACE & VEHICLE BUS OBJECTS       \n');
fprintf('=================================================================\n\n');

% 1. Load Physical Vehicle Parameters
addpath(genpath(fullfile('c:', 'Users', 'narut', 'OneDrive', 'Desktop', 'sih', 'planning_and_control')));
vehParams = vehicle_params();
assignin('base', 'vehParams', vehParams);
fprintf('1. [OK] Vehicle parameters loaded into Base Workspace.\n');

% 2. Create Simulink Bus Definitions
% Bus A: Ego Vehicle State
elems(1) = Simulink.BusElement; elems(1).Name = 'X'; elems(1).DataType = 'double';
elems(2) = Simulink.BusElement; elems(2).Name = 'Y'; elems(2).DataType = 'double';
elems(3) = Simulink.BusElement; elems(3).Name = 'Yaw'; elems(3).DataType = 'double';
elems(4) = Simulink.BusElement; elems(4).Name = 'Vx'; elems(4).DataType = 'double';
elems(5) = Simulink.BusElement; elems(5).Name = 'Vy'; elems(5).DataType = 'double';
elems(6) = Simulink.BusElement; elems(6).Name = 'YawRate'; elems(6).DataType = 'double';
EgoVehicleState_Bus = Simulink.Bus;
EgoVehicleState_Bus.Elements = elems;
assignin('base', 'EgoVehicleState_Bus', EgoVehicleState_Bus);

% Bus B: Trajectory Reference Command
clear elems;
elems(1) = Simulink.BusElement; elems(1).Name = 'TargetX'; elems(1).DataType = 'double';
elems(2) = Simulink.BusElement; elems(2).Name = 'TargetY'; elems(2).DataType = 'double';
elems(3) = Simulink.BusElement; elems(3).Name = 'TargetYaw'; elems(3).DataType = 'double';
elems(4) = Simulink.BusElement; elems(4).Name = 'TargetV'; elems(4).DataType = 'double';
elems(5) = Simulink.BusElement; elems(5).Name = 'TargetCurv'; elems(5).DataType = 'double';
TrajectoryCommand_Bus = Simulink.Bus;
TrajectoryCommand_Bus.Elements = elems;
assignin('base', 'TrajectoryCommand_Bus', TrajectoryCommand_Bus);

% Bus C: Control Actuation Output
clear elems;
elems(1) = Simulink.BusElement; elems(1).Name = 'SteeringAngleRad'; elems(1).DataType = 'double';
elems(2) = Simulink.BusElement; elems(2).Name = 'ThrottleNormalized'; elems(2).DataType = 'double';
elems(3) = Simulink.BusElement; elems(3).Name = 'BrakeNormalized'; elems(3).DataType = 'double';
elems(4) = Simulink.BusElement; elems(4).Name = 'AEB_ActiveFlag'; elems(4).DataType = 'boolean';
ControlActuation_Bus = Simulink.Bus;
ControlActuation_Bus.Elements = elems;
assignin('base', 'ControlActuation_Bus', ControlActuation_Bus);

fprintf('2. [OK] Simulink Bus definitions generated:\n');
fprintf('   - EgoVehicleState_Bus\n');
fprintf('   - TrajectoryCommand_Bus\n');
fprintf('   - ControlActuation_Bus\n\n');

% 3. Generate Reference Path & Time-Series for Simulation
s_arr = 0:0.5:150;
ref_x = s_arr;
ref_y = 2.5 * sin(s_arr / 15.0);
ref_yaw = zeros(size(s_arr));
for i = 1:length(s_arr)-1
    ref_yaw(i) = atan2(ref_y(i+1) - ref_y(i), ref_x(i+1) - ref_x(i));
end
ref_yaw(end) = ref_yaw(end-1);

assignin('base', 'Ref_X', ref_x);
assignin('base', 'Ref_Y', ref_y);
assignin('base', 'Ref_Yaw', ref_yaw);
assignin('base', 'Ref_Speed', vehParams.TargetSpeedUrban);

fprintf('3. [OK] Reference trajectory variables initialized.\n');
fprintf('=================================================================\n');
fprintf('Simulink Workspace is fully configured and ready!\n');
fprintf('=================================================================\n');
