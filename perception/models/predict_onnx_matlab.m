%% predict_onnx_matlab.m
% AI/ML Perception Subsystem
% Runs ONNX Model Inference & Segmentation in MATLAB.
% Plots bounding boxes, road segmentation masks, and metrics in MATLAB Figure.

clear; clc; close all;
fprintf('=================================================================\n');
fprintf('       ONNX MODEL PREDICTION & SEGMENTATION IN MATLAB            \n');
fprintf('=================================================================\n\n');

% 1. Paths
rootDir = fullfile('c:', 'Users', 'narut', 'OneDrive', 'Desktop', 'sih');
onnxPath = fullfile(rootDir, 'yolov8n-seg.onnx');
imgDir = fullfile(rootDir, 'IDD_RESIZED', 'image_archive');

if ~isfile(onnxPath)
    onnxPath = fullfile(rootDir, 'perception', 'models', 'runs_idd', 'idd_road_seg', 'weights', 'best.onnx');
end

fprintf('1. Loading ONNX Model: %s...\n', onnxPath);
pyModel = py.ultralytics.YOLO(onnxPath, pyargs('task', 'segment'));
fprintf('   [OK] ONNX Engine loaded.\n\n');

% 2. Select Sample Indian Road Image
imgFiles = dir(fullfile(imgDir, 'Image_*.png'));
if isempty(imgFiles)
    error('No images found in %s', imgDir);
end

testImgPath = fullfile(imgDir, imgFiles(1).name);
fprintf('2. Running Prediction on: %s...\n', imgFiles(1).name);

tic;
pyRes = pyModel.predict(testImgPath, pyargs('conf', 0.25, 'imgsz', int32(640), 'verbose', false));
latencyMs = toc * 1000;
fprintf('   [SUCCESS] Inference completed in %.1f ms (%.1f FPS).\n\n', latencyMs, 1000/latencyMs);

% 3. Extract and Render in MATLAB Figure
firstRes = pyRes{1};
annotatedArray = uint8(py.numpy.array(firstRes.plot()));
annotatedRGB = annotatedArray(:, :, [3 2 1]);

fig = figure('Name', 'ONNX Model Prediction & Segmentation Viewer', ...
             'Color', [0.08 0.10 0.14], ...
             'Position', [80 80 960 680]);

imshow(annotatedRGB);
title(sprintf('ONNX Segmentation & Detection | Latency: %.1f ms (%.1f FPS)', latencyMs, 1000/latencyMs), ...
      'Color', [0.2 1.0 0.4], 'FontSize', 13, 'FontWeight', 'bold');

fprintf('=================================================================\n');
fprintf('Image displayed with ONNX predictions in MATLAB Figure!\n');
fprintf('=================================================================\n');
