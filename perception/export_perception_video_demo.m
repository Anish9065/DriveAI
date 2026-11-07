%% export_perception_video_demo.m
% AI/ML #1 - Perception Module
% Renders and exports a 10-second MP4 demonstration video of the Perception & Sensor Fusion Dashboard
% for SIH presentation and progress reporting.

clear; clc; close all;
fprintf('===============================================================\n');
fprintf('  Rendering Perception & Sensor Fusion Demo Video (MP4)       \n');
fprintf('===============================================================\n\n');

% Add paths
addpath(genpath(fullfile(pwd)));

% Setup Video Writer
videoFilename = fullfile(pwd, 'perception_simulation_demo.mp4');
vWriter = VideoWriter(videoFilename, 'MPEG-4');
vWriter.FrameRate = 10;
open(vWriter);

% Dashboard Figure (Off-screen render)
fig = figure('Name', 'Perception Video Generator', ...
             'Color', [0.12 0.14 0.18], ...
             'Position', [50 50 1200 700], ...
             'Visible', 'off');

% Setup Tracker
tracker = setup_tracker_gnn();
totalTime = 8.0;
dt = 0.1;
timeSteps = 0:dt:totalTime;
numFrames = length(timeSteps);

fprintf('Rendering %d frames to %s...\n', numFrames, videoFilename);

for step = 1:numFrames
    t = timeSteps(step);
    
    % Scenario: Sudden Cattle Crossing + Auto-Rickshaw
    agents = {
        struct('Class', 'cattle', 'conf', 0.96, 'x', 22.0, 'y', max(-2.0, 3.5 - 0.7*t), 'vx', 0.0, 'vy', -0.7), ...
        struct('Class', 'auto_rickshaw', 'conf', 0.92, 'x', 8.0 + 4.5*t, 'y', -1.2, 'vx', 4.5, 'vy', 0.0), ...
        struct('Class', 'pushcart', 'conf', 0.90, 'x', 6.0 + 0.9*t, 'y', -3.2, 'vx', 0.9, 'vy', 0.0)
    };

    % Synthesize Sensor Measurements
    sensorDetections = {};
    for k = 1:length(agents)
        ag = agents{k};
        if ag.x > 0 && ag.x < 50
            sensorDetections{end+1} = objectDetection(t, [ag.x; ag.y; 0] + 0.1*randn(3,1), ...
                'SensorIndex', 1, 'MeasurementNoise', diag([0.3^2, 0.4^2, 0.2^2]), ...
                'ObjectAttributes', struct('Class', ag.Class, 'ClassConfidence', ag.conf));
            sensorDetections{end+1} = objectDetection(t, [ag.x; ag.y; 0] + 0.08*randn(3,1), ...
                'SensorIndex', 2, 'MeasurementNoise', diag([0.1^2, 0.6^2, 0.5^2]), ...
                'ObjectAttributes', struct('Class', ag.Class, 'ClassConfidence', 0.8));
            sensorDetections{end+1} = objectDetection(t, [ag.x; ag.y; 0] + 0.05*randn(3,1), ...
                'SensorIndex', 3, 'MeasurementNoise', diag([0.15^2, 0.15^2, 0.1^2]), ...
                'ObjectAttributes', struct('Class', ag.Class, 'ClassConfidence', 0.9));
        end
    end

    % Fuse
    [trackedObjects, tracker] = fuse_sensor_detections(sensorDetections, tracker, t);

    % Render BEV Plot
    clf(fig);
    
    % Subplot 1: BEV Plot
    subplot('Position', [0.08 0.15 0.85 0.75]);
    set(gca, 'Color', [0.08 0.10 0.14], 'XColor', [0.9 0.9 0.9], 'YColor', [0.9 0.9 0.9]);
    grid on; hold on;
    xlim([-5 45]); ylim([-6 6]);
    xlabel('Longitudinal X (m)'); ylabel('Lateral Y (m)');
    title(sprintf('SIH Autonomous Vehicle - Perception & Sensor Fusion | Time: %.1f s', t), ...
          'Color', [0.3 0.8 1.0], 'FontSize', 12, 'FontWeight', 'bold');

    % Ego vehicle
    plot(0, 0, 'bs', 'MarkerSize', 14, 'MarkerFaceColor', [0.1 0.6 1.0]);
    text(-4, 0, 'EGO', 'Color', [0.3 0.8 1.0], 'FontWeight', 'bold');

    % Road & Shoulders
    plot([-5 45], [3.5 3.5], '--', 'Color', [0.6 0.6 0.6], 'LineWidth', 1);
    plot([-5 45], [-3.5 -3.5], '--', 'Color', [0.6 0.6 0.6], 'LineWidth', 1);
    plot([-5 45], [5.5 5.5], '-', 'Color', [0.7 0.5 0.3], 'LineWidth', 1.5);
    plot([-5 45], [-5.5 -5.5], '-', 'Color', [0.7 0.5 0.3], 'LineWidth', 1.5);

    % Tracks
    for trIdx = 1:length(trackedObjects)
        tr = trackedObjects(trIdx);
        if tr.IsConfirmed
            pos = tr.Position;
            vel = tr.Velocity;
            dim = tr.BoundingBox3D;
            
            rectangle('Position', [pos(1)-dim(1)/2, pos(2)-dim(2)/2, dim(1), dim(2)], ...
                      'EdgeColor', [1.0 0.3 0.3], 'LineWidth', 2.0);
            quiver(pos(1), pos(2), vel(1), vel(2), 0.5, 'Color', [1.0 0.8 0.2], 'LineWidth', 1.5, 'MaxHeadSize', 1);
            text(pos(1)+0.5, pos(2)+0.8, sprintf('ID:%d %s (%.1fm/s)', tr.TrackID, tr.Class, tr.Speed), ...
                 'Color', [1.0 0.3 0.3], 'FontSize', 9, 'FontWeight', 'bold');
        end
    end

    % Write frame to video
    frame = getframe(fig);
    writeVideo(vWriter, frame);
end

close(vWriter);
close(fig);
fprintf('\n[SUCCESS] Demo video generated successfully: %s\n', videoFilename);
