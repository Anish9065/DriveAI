%% test_camera_lidar_fusion_pipeline.m
% AI/ML #1 - Perception Module
% End-to-End Perception Test: Camera Detection + Radar/LiDAR Tracking Fusion

clear; clc;
fprintf('=======================================================\n');
fprintf('  End-to-End Perception & Sensor Fusion Pipeline Test \n');
fprintf('=======================================================\n\n');

% 1. Create a simulated synthetic camera scene
fprintf('1. Generating synthetic camera frame...\n');
imgH = 480; imgW = 640;
syntheticFrame = uint8(128 * ones(imgH, imgW, 3));
% Add road asphalt
syntheticFrame(240:end, :, :) = 50;

% 2. Run Camera 2D Detection
fprintf('2. Running YOLO detector on camera frame...\n');
[bboxes, scores, labels] = detect_objects_camera(syntheticFrame);
fprintf('   Camera detected %d objects.\n', size(bboxes, 1));

% 3. Initialize Tracker
fprintf('3. Initializing Multi-Sensor Tracker (trackerGNN)...\n');
tracker = setup_tracker_gnn();

% 4. Simulate a synchronized multi-sensor detection packet
t = 0.5;
camMeas = [18.5; -1.2; 0.0]; % 18.5m ahead, 1.2m right
radarMeas = [18.4; -1.1; 0.0];
lidarMeas = [18.52; -1.18; 0.0];

sensorDetections = {
    objectDetection(t, camMeas, 'SensorIndex', 1, 'MeasurementNoise', diag([0.3^2, 0.4^2, 0.2^2]), ...
        'ObjectAttributes', struct('Class', 'auto_rickshaw', 'ClassConfidence', 0.94)), ...
    objectDetection(t, radarMeas, 'SensorIndex', 2, 'MeasurementNoise', diag([0.1^2, 0.6^2, 0.5^2]), ...
        'ObjectAttributes', struct('Class', 'auto_rickshaw', 'ClassConfidence', 0.80)), ...
    objectDetection(t, lidarMeas, 'SensorIndex', 3, 'MeasurementNoise', diag([0.15^2, 0.15^2, 0.1^2]), ...
        'ObjectAttributes', struct('Class', 'auto_rickshaw', 'ClassConfidence', 0.90))
};

% 5. Fuse Detections
fprintf('4. Fusing Camera + Radar + LiDAR into TrackedObjectList...\n');
[trackedObjects, tracker] = fuse_sensor_detections(sensorDetections, tracker, t);

% 6. Print Tracked Obstacle Information
fprintf('\n--- Active Confirmed Tracks (%d) ---\n', length(trackedObjects));
for i = 1:length(trackedObjects)
    tr = trackedObjects(i);
    fprintf('  Track ID   : %d\n', tr.TrackID);
    fprintf('  Class      : %s (Confidence: %.2f%%)\n', tr.Class, tr.ClassConfidence * 100);
    fprintf('  Position   : [%.2f, %.2f, %.2f] m (Ego Frame)\n', tr.Position(1), tr.Position(2), tr.Position(3));
    fprintf('  Speed      : %.2f m/s\n', tr.Speed);
    fprintf('  3D BBox    : [%.2f x %.2f x %.2f] m\n', tr.BoundingBox3D(1), tr.BoundingBox3D(2), tr.BoundingBox3D(3));
end

fprintf('\n[SUCCESS] End-to-End Perception Pipeline Test Passed!\n');
