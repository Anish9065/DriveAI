%% test_best_onnx_matlab.m
% AI/ML Perception Module
% Tests the fine-tuned 'best.onnx' model directly inside MATLAB.
% Performs inference on Indian road test scenes and displays the visual segmentation.

clear; clc; close all;
fprintf('===============================================================\n');
fprintf('       TESTING BEST.ONNX MODEL IN MATLAB                       \n');
fprintf('===============================================================\n\n');

% 1. Paths
rootDir = fullfile('c:', 'Users', 'narut', 'OneDrive', 'Desktop', 'sih');
onnxPath = fullfile(rootDir, 'perception', 'models', 'runs_idd', 'idd_road_seg', 'weights', 'best.onnx');
imgDir = fullfile(rootDir, 'IDD_RESIZED', 'image_archive');

if ~isfile(onnxPath)
    error('best.onnx not found at: %s', onnxPath);
end
fprintf('1. [OK] Found ONNX Model: \n   %s\n\n', onnxPath);

% 2. Load ONNX model via YOLO Python bridge
fprintf('2. Loading best.onnx model...\n');
pyModel = py.ultralytics.YOLO(onnxPath, pyargs('task', 'segment'));
fprintf('   [OK] best.onnx successfully loaded.\n\n');

% 3. Pick Sample Indian Road Images
imgFiles = dir(fullfile(imgDir, 'Image_*.png'));
if isempty(imgFiles)
    error('No images found in %s', imgDir);
end

testImgPath = fullfile(imgDir, imgFiles(1).name);
fprintf('3. Running ONNX inference on: %s...\n', imgFiles(1).name);

tic;
pyRes = pyModel.predict(testImgPath, pyargs('conf', 0.20, 'imgsz', int32(512), 'verbose', false));
inferLatency = toc * 1000;
fprintf('   [SUCCESS] ONNX Inference completed in %.1f ms.\n\n', inferLatency);

% 4. Render and Display in MATLAB Figure
firstRes = pyRes{1};
annotatedArray = uint8(py.numpy.array(firstRes.plot())); % OpenCV BGR
annotatedRGB = annotatedArray(:, :, [3 2 1]);           % Convert BGR to RGB for MATLAB

fig = figure('Name', 'Fine-Tuned best.onnx Road Perception Test', ...
             'Color', [0.10 0.12 0.16], ...
             'Position', [100 100 800 650]);

imshow(annotatedRGB);
title(sprintf('Fine-Tuned best.onnx Output | Inference Time: %.1f ms (%.1f FPS)', inferLatency, 1000/inferLatency), ...
      'Color', [0.2 1.0 0.4], 'FontSize', 13, 'FontWeight', 'bold');

fprintf('===============================================================\n');
fprintf('Visual segmentation window displayed successfully!\n');
fprintf('===============================================================\n');
