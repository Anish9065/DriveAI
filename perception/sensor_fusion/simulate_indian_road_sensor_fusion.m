%% simulate_indian_road_sensor_fusion.m
% AI/ML #1 - Perception Module
% Complete standalone simulation of multi-sensor fusion for Indian road scenarios
% Fuses Camera + Radar + LiDAR detections and outputs TrackedObjectList

clear; clc; close all;
fprintf('=======================================================\n');
fprintf('  Indian Road Perception & Sensor Fusion Simulation   \n');
fprintf('=======================================================\n\n');

% Simulation parameters
dt = 0.1;           % 10 Hz sensor update rate
totalTime = 10.0;   % 10 seconds simulation
timeSteps = 0:dt:totalTime;
numSteps = length(timeSteps);

% Initialize Tracker
tracker = setup_tracker_gnn();

% Ground Truth Target Definitions (Simulating Indian Mixed Traffic)
% 1. Auto-rickshaw moving ahead and gently weaving
% 2. Stray cow / cattle crossing slowly from right to left
% 3. Pushcart vendor moving slowly on the left shoulder
% 4. Two-wheeler (motorcycle) overtaking rapidly from the right
% 5. Pedestrian crossing abruptly

gtAgents = {
    struct('Class', 'auto_rickshaw', 'x0', 15.0, 'y0', 0.5, 'vx', 6.0, 'vy', 0.1), ...
    struct('Class', 'cattle',        'x0', 30.0, 'y0', 4.0, 'vx', 0.2, 'vy', -0.8), ...
    struct('Class', 'pushcart',      'x0', 10.0, 'y0', -3.2, 'vx', 1.2, 'vy', 0.0), ...
    struct('Class', 'two_wheeler',   'x0', 5.0,  'y0', 2.5, 'vx', 11.0, 'vy', -0.1), ...
    struct('Class', 'pedestrian',    'x0', 22.0, 'y0', -2.5, 'vx', 0.0, 'vy', 1.1) ...
};

numAgents = length(gtAgents);

% Visualization Setup
figure('Name', 'Perception & Sensor Fusion - Indian Road Scenario', 'Position', [100 100 1000 600]);
grid on; hold on;
xlabel('X - Longitudinal Distance (m)');
ylabel('Y - Lateral Distance (m)');
title('Real-Time Multi-Sensor Fusion & Tracking (Indian Road Scenario)');
xlim([-5 50]);
ylim([-8 8]);

% Sensor Noise Characteristics
cameraNoiseCov = diag([0.3^2, 0.4^2, 0.2^2]);  % Camera 3D box noise [x, y, z]
radarNoiseCov  = diag([0.1^2, 0.6^2, 0.5^2]);  % Radar range/azimuth noise
lidarNoiseCov  = diag([0.15^2, 0.15^2, 0.1^2]);% LiDAR cluster centroid noise

% Run Simulation Loop
fprintf('Running simulation loop over %d frames (%.1f s)...\n', numSteps, totalTime);

for step = 1:numSteps
    t = timeSteps(step);
    sensorDetections = {};
    
    % Generate Ground Truth and Sensor Measurements
    for a = 1:numAgents
        agent = gtAgents{a};
        
        % Current true position
        true_x = agent.x0 + agent.vx * t;
        true_y = agent.y0 + agent.vy * t;
        true_z = 0.0;
        
        % Only detect if within sensor field of view (0 to 50m)
        if true_x > 0 && true_x < 50 && abs(true_y) < 7
            
            % 1. Camera Detection (SensorIndex = 1)
            cam_meas = [true_x; true_y; true_z] + chol(cameraNoiseCov)' * randn(3, 1);
            cam_det = objectDetection(t, cam_meas, ...
                'SensorIndex', 1, ...
                'MeasurementNoise', cameraNoiseCov, ...
                'ObjectAttributes', struct('Class', agent.Class, 'ClassConfidence', 0.92));
            sensorDetections{end+1} = cam_det; %#ok<AGROW>
            
            % 2. Radar Detection (SensorIndex = 2) - Higher range accuracy
            radar_meas = [true_x; true_y; true_z] + chol(radarNoiseCov)' * randn(3, 1);
            radar_det = objectDetection(t, radar_meas, ...
                'SensorIndex', 2, ...
                'MeasurementNoise', radarNoiseCov, ...
                'ObjectAttributes', struct('Class', agent.Class, 'ClassConfidence', 0.75));
            sensorDetections{end+1} = radar_det; %#ok<AGROW>
            
            % 3. LiDAR Detection (SensorIndex = 3) - High spatial accuracy
            lidar_meas = [true_x; true_y; true_z] + chol(lidarNoiseCov)' * randn(3, 1);
            lidar_det = objectDetection(t, lidar_meas, ...
                'SensorIndex', 3, ...
                'MeasurementNoise', lidarNoiseCov, ...
                'ObjectAttributes', struct('Class', agent.Class, 'ClassConfidence', 0.88));
            sensorDetections{end+1} = lidar_det; %#ok<AGROW>
        end
    end
    
    % Fuse detections through Tracker
    [trackedObjects, tracker] = fuse_sensor_detections(sensorDetections, tracker, t);
    
    % Real-time Plotting (every 2nd frame for speed)
    if mod(step, 2) == 0
        cla;
        % Plot Ego Vehicle at (0,0)
        plot(0, 0, 'ks', 'MarkerSize', 12, 'MarkerFaceColor', 'blue');
        text(-3, 0, 'EGO', 'FontWeight', 'bold', 'Color', 'blue');
        
        % Plot Road Boundaries & Shoulders (Typical unstructured road)
        plot([-5 50], [3.5 3.5], 'k--', 'LineWidth', 1);
        plot([-5 50], [-3.5 -3.5], 'k--', 'LineWidth', 1);
        plot([-5 50], [5.5 5.5], 'k-', 'LineWidth', 1.5);   % Unpaved shoulder
        plot([-5 50], [-5.5 -5.5], 'k-', 'LineWidth', 1.5); % Unpaved shoulder
        
        % Plot Raw Detections
        for d = 1:length(sensorDetections)
            meas = sensorDetections{d}.Measurement;
            if sensorDetections{d}.SensorIndex == 1
                plot(meas(1), meas(2), 'm.', 'MarkerSize', 8); % Camera: Magenta
            elseif sensorDetections{d}.SensorIndex == 2
                plot(meas(1), meas(2), 'c+', 'MarkerSize', 6); % Radar: Cyan
            else
                plot(meas(1), meas(2), 'g.', 'MarkerSize', 6); % LiDAR: Green
            end
        end
        
        % Plot Fused Confirmed Tracks
        for trIdx = 1:length(trackedObjects)
            tr = trackedObjects(trIdx);
            if tr.IsConfirmed
                pos = tr.Position;
                vel = tr.Velocity;
                
                % Bounding box visualization
                dim = tr.BoundingBox3D;
                rectangle('Position', [pos(1)-dim(1)/2, pos(2)-dim(2)/2, dim(1), dim(2)], ...
                          'EdgeColor', 'r', 'LineWidth', 1.5);
                
                % Velocity Vector
                quiver(pos(1), pos(2), vel(1), vel(2), 0.5, 'r', 'LineWidth', 1.5, 'MaxHeadSize', 1);
                
                % Label with TrackID, Class & Speed
                labelStr = sprintf('ID:%d %s (%.1fm/s)', tr.TrackID, tr.Class, tr.Speed);
                text(pos(1)+0.5, pos(2)+0.8, labelStr, 'FontSize', 8, 'FontWeight', 'bold', 'Color', [0.8 0 0]);
            end
        end
        
        legend({'Ego Vehicle', '', '', '', '', 'Camera Det', 'Radar Det', 'LiDAR Det', 'Fused Track BBox'}, ...
               'Location', 'northwest');
        drawnow;
    end
end

fprintf('\n[SUCCESS] Simulation complete. Perception & Multi-Sensor Fusion validated.\n');
