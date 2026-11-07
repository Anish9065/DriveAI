%% test_fine_tuned_idd_model.m
% AI/ML #1 - Perception Module
% Evaluates and displays the Fine-Tuned IDD Road & Drivable Corridor Segmentation
% Overlays the road mask and displays training loss & validation curves.

clear; clc; close all;
fprintf('===============================================================\n');
fprintf('    FINE-TUNED IDD ROAD PERCEPTION EVALUATOR (MATLAB)          \n');
fprintf('===============================================================\n\n');

% 1. Locate absolute directories
currentDir = pwd;
rootDir = fullfile('c:', 'Users', 'narut', 'OneDrive', 'Desktop', 'sih');
iddImgDir = fullfile(rootDir, 'IDD_RESIZED', 'image_archive');
weightsPath = fullfile(rootDir, 'perception', 'models', 'runs_idd', 'idd_road_seg', 'weights', 'best.pt');
trainingPlotsDir = fullfile(rootDir, 'perception', 'models', 'runs_idd', 'idd_road_seg');

% 2. Check if Fine-Tuned Model exists
if isfile(weightsPath)
    fprintf('1. [OK] Found Fine-Tuned Model Weights: \n   %s\n', weightsPath);
else
    fprintf('1. [WARNING] Fine-tuned weights not found at %s. Using default model.\n', weightsPath);
    weightsPath = 'yolov8n-seg.pt';
end

% 3. Load YOLO Model via MATLAB Python Engine
fprintf('2. Initializing YOLO Perception Engine...\n');
pyModel = py.ultralytics.YOLO(weightsPath);
fprintf('   [OK] Model successfully loaded into memory.\n');

% 4. Load a Test Indian Road Scene
imgFiles = dir(fullfile(iddImgDir, 'Image_*.png'));
if isempty(imgFiles)
    error('No images found in %s', iddImgDir);
end

% Pick test image (e.g., Image_0.png)
testImgPath = fullfile(iddImgDir, imgFiles(1).name);
fprintf('3. Running Live Inference on Indian Road Image: %s...\n', imgFiles(1).name);

tic;
pyRes = pyModel.predict(testImgPath, pyargs('conf', 0.20, 'verbose', false));
inferLatency = toc * 1000;
fprintf('   [SUCCESS] Inference completed in %.1f ms.\n', inferLatency);

% 5. Extract Annotated Segmented Frame from YOLO
firstRes = pyRes{1};
annotatedArray = uint8(py.numpy.array(firstRes.plot())); % OpenCV BGR
annotatedRGB = annotatedArray(:, :, [3 2 1]); % Convert BGR to RGB for MATLAB

% 6. Create Dual-Panel Visual Dashboard (Inference + Training Curves)
fig = figure('Name', 'Fine-Tuned IDD Road Perception Dashboard', ...
             'Color', [0.10 0.12 0.16], ...
             'Position', [50 50 1200 650]);

% Subplot 1: Live Segmentation Output
subplot(1, 2, 1);
imshow(annotatedRGB);
title(sprintf('Fine-Tuned Drivable Road Segmentation | Latency: %.1f ms', inferLatency), ...
      'Color', [0.2 1.0 0.4], 'FontSize', 12, 'FontWeight', 'bold');

% Subplot 2: Training Loss and mAP Curves
resultsPlotPath = fullfile(trainingPlotsDir, 'results.png');
if isfile(resultsPlotPath)
    subplot(1, 2, 2);
    resultsImg = imread(resultsPlotPath);
    imshow(resultsImg);
    title('Fine-Tuning Verification (Loss & mAP Curves Across Epochs)', ...
          'Color', [0.3 0.8 1.0], 'FontSize', 12, 'FontWeight', 'bold');
end

fprintf('\n===============================================================\n');
fprintf('PERCEPTION DASHBOARD DISPLAYED:\n');
fprintf(' - Left Panel : Live segmented drivable road on Indian scene.\n');
fprintf(' - Right Panel: Training loss and mAP validation curves.\n');
fprintf('===============================================================\n');
