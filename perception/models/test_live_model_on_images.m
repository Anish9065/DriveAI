%% test_live_model_on_images.m
% AI/ML #1 - Perception Module
% Live Model Visual Tester: Runs YOLO detection and displays the visual output window
% with bounding boxes, confidence scores, and class labels.

clear; clc; close all;
fprintf('===============================================================\n');
fprintf('     LIVE MODEL VISUAL TESTER (YOLO OBJECT DETECTION)          \n');
fprintf('===============================================================\n\n');

% Add paths
addpath(fullfile(pwd));

% 1. Create/Load Sample Test Images
fprintf('1. Preparing test image...\n');
testDir = fullfile(pwd, 'test_images');
if ~exist(testDir, 'dir')
    mkdir(testDir);
end

% Try downloading a real street driving test image from standard repository if online
sampleImgPath = fullfile(testDir, 'sample_street_test.jpg');
if ~isfile(sampleImgPath)
    try
        fprintf('   Fetching real-world driving test image...\n');
        websave(sampleImgPath, 'https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/bus.jpg');
        fprintf('   [OK] Test image downloaded.\n');
    catch
        % Fallback: Generate a structured street scene
        fprintf('   Generating realistic test driving scene...\n');
        imgH = 480; imgW = 640;
        testImg = uint8(zeros(imgH, imgW, 3));
        testImg(1:200, :, 1) = 135; testImg(1:200, :, 2) = 180; testImg(1:200, :, 3) = 220; % Sky
        testImg(201:end, :, :) = 50; % Road
        imwrite(testImg, sampleImgPath);
    end
end

% 2. Read Image
img = imread(sampleImgPath);
fprintf('2. Image loaded: %d x %d pixels.\n', size(img, 1), size(img, 2));

% 3. Run Live YOLO Model Inference
fprintf('3. Running LIVE YOLOv8 Inference on image...\n');
tic;
[bboxes, scores, labels] = detect_objects_camera(img);
inferenceTime = toc * 1000; % ms

fprintf('   [SUCCESS] Detection complete in %.1f ms.\n', inferenceTime);
fprintf('   Found %d object(s):\n', size(bboxes, 1));
for k = 1:size(bboxes, 1)
    fprintf('    - %-12s | Confidence: %5.1f%% | BBox: [x=%.0f, y=%.0f, w=%.0f, h=%.0f]\n', ...
        labels{k}, scores(k)*100, bboxes(k,1), bboxes(k,2), bboxes(k,3), bboxes(k,4));
end

% 4. Display Visual Output Window with Annotations
fig = figure('Name', 'Live YOLO Model Detection Output', ...
             'Color', [0.12 0.14 0.18], ...
             'Position', [100 100 900 650]);
         
imshow(img); hold on;
title(sprintf('Live YOLOv8 Detection Result | %d Objects Detected | Latency: %.1f ms', size(bboxes, 1), inferenceTime), ...
      'Color', [0.2 1.0 0.4], 'FontSize', 12, 'FontWeight', 'bold');

% Draw bounding boxes and labels
for k = 1:size(bboxes, 1)
    box = bboxes(k, :);
    rectangle('Position', box, 'EdgeColor', [0.0 1.0 0.0], 'LineWidth', 2.5);
    
    labelStr = sprintf(' %s: %.0f%% ', labels{k}, scores(k) * 100);
    text(box(1), max(15, box(2) - 10), labelStr, ...
         'BackgroundColor', [0.0 0.8 0.2], 'Color', [0 0 0], ...
         'FontSize', 10, 'FontWeight', 'bold');
end

hold off;
fprintf('\n===============================================================\n');
fprintf('Visual window displayed. Close the window when done.\n');
fprintf('===============================================================\n');
