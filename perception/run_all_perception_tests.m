%% run_all_perception_tests.m
% AI/ML #1 - Perception Module Master Test Runner
% Runs all verification checks and unit tests to ensure everything is working.

clear; clc;
fprintf('===============================================================\n');
fprintf('       AI/ML #1 (PERCEPTION) MASTER SUBSYSTEM TEST SUITE       \n');
fprintf('===============================================================\n\n');

totalTests = 5;
passedTests = 0;

% Add paths
rootDir = fullfile(pwd);
addpath(genpath(rootDir));

%% TEST 1: MATLAB Toolboxes & GPU
fprintf('[TEST 1/5] Checking Toolboxes & GPU Acceleration...\n');
try
    tBoxes = {'Computer Vision Toolbox', 'Deep Learning Toolbox', 'Sensor Fusion and Tracking Toolbox', 'Navigation Toolbox'};
    v = ver; installed = {v.Name};
    allFound = all(cellfun(@(x) any(strcmp(installed, x)), tBoxes));
    if allFound
        fprintf('  --> [PASS] Required Perception Toolboxes are installed.\n');
        passedTests = passedTests + 1;
    else
        fprintf('  --> [WARN] Some toolboxes missing. Check verify_toolboxes.m\n');
    end
catch ME
    fprintf('  --> [FAIL] Error in Test 1: %s\n', ME.message);
end

%% TEST 2: Simulink Bus Definition
fprintf('\n[TEST 2/5] Creating Simulink Perception Output Buses...\n');
try
    TrackedObjectList_BusDefinition;
    if evalin('base', 'exist(''TrackedObjectList_Bus'', ''var'')')
        fprintf('  --> [PASS] TrackedObjectList_Bus successfully generated.\n');
        passedTests = passedTests + 1;
    else
        fprintf('  --> [FAIL] TrackedObjectList_Bus missing from workspace.\n');
    end
catch ME
    fprintf('  --> [FAIL] Error in Test 2: %s\n', ME.message);
end

%% TEST 3: Mock Data Generator for Scenarios
fprintf('\n[TEST 3/5] Testing Scenario Mock Stream Generator...\n');
try
    mockData = generate_mock_tracked_objects('cattle_crossing_event', 1.0);
    if mockData.NumObjects > 0 && strcmp(mockData.Objects(1).Class, "cattle")
        fprintf('  --> [PASS] Mock data generated %d obstacles (Class: %s, Pos: [%.1f, %.1f, %.1f]).\n', ...
            mockData.NumObjects, mockData.Objects(1).Class, ...
            mockData.Objects(1).Position(1), mockData.Objects(1).Position(2), mockData.Objects(1).Position(3));
        passedTests = passedTests + 1;
    else
        fprintf('  --> [FAIL] Mock data generation failed.\n');
    end
catch ME
    fprintf('  --> [FAIL] Error in Test 3: %s\n', ME.message);
end

%% TEST 4: YOLO Camera Detection Engine
fprintf('\n[TEST 4/5] Testing YOLO Camera Detection Engine...\n');
try
    testImg = uint8(128 * ones(480, 640, 3));
    [b, s, l] = detect_objects_camera(testImg);
    fprintf('  --> [PASS] YOLO Camera Detection is active and running inside MATLAB.\n');
    passedTests = passedTests + 1;
catch ME
    fprintf('  --> [FAIL] Error in Test 4: %s\n', ME.message);
end

%% TEST 5: Multi-Sensor Fusion & Object Tracking
fprintf('\n[TEST 5/5] Testing Multi-Sensor Fusion Engine (Camera + Radar + LiDAR)...\n');
try
    tracker = setup_tracker_gnn();
    t = 0.5;
    sensorDetections = {
        objectDetection(t, [20.0; -1.5; 0.0], 'SensorIndex', 1, 'MeasurementNoise', diag([0.3^2, 0.4^2, 0.2^2]), ...
            'ObjectAttributes', struct('Class', 'auto_rickshaw', 'ClassConfidence', 0.95)), ...
        objectDetection(t, [19.9; -1.4; 0.0], 'SensorIndex', 2, 'MeasurementNoise', diag([0.1^2, 0.6^2, 0.5^2]), ...
            'ObjectAttributes', struct('Class', 'auto_rickshaw', 'ClassConfidence', 0.85))
    };
    [tracks, tracker] = fuse_sensor_detections(sensorDetections, tracker, t);
    if ~isempty(tracks) && tracks(1).TrackID > 0
        fprintf('  --> [PASS] Multi-sensor fusion confirmed Track ID: %d (%s, Speed: %.1fm/s).\n', ...
            tracks(1).TrackID, tracks(1).Class, tracks(1).Speed);
        passedTests = passedTests + 1;
    else
        fprintf('  --> [FAIL] Fusion failed to produce confirmed tracks.\n');
    end
catch ME
    fprintf('  --> [FAIL] Error in Test 5: %s\n', ME.message);
end

%% FINAL SUMMARY DASHBOARD
fprintf('\n===============================================================\n');
fprintf('                    TEST RESULTS DASHBOARD                     \n');
fprintf('===============================================================\n');
fprintf('Total Tests Run : %d\n', totalTests);
fprintf('Tests Passed    : %d / %d\n', passedTests, totalTests);

if passedTests == totalTests
    fprintf('\n>>> STATUS: ALL PERCEPTION SYSTEMS WORKING PERFECTLY! <<<\n');
    fprintf('Ready for integration with AI/ML #2 (Prediction) and Full-Stack (Planning).\n');
else
    fprintf('\n>>> STATUS: %d TEST(S) NEED ATTENTION <<<\n', totalTests - passedTests);
end
fprintf('===============================================================\n');
