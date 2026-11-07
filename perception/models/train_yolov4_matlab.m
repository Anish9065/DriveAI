%% train_yolov4_matlab.m
% AI/ML #1 - Perception Module
% Fine-tuning YOLOv4 Object Detector for Indian Road Classes in MATLAB

clear; clc;
fprintf('=======================================================\n');
fprintf('  Fine-Tuning YOLOv4 for Indian Road Conditions       \n');
fprintf('=======================================================\n\n');

% 1. Define Model Parameters & Classes
inputSize = [416 416 3];
classNames = {'car', 'bus', 'truck', 'auto_rickshaw', 'two_wheeler', ...
              'bicycle', 'pedestrian', 'pushcart', 'cattle'};
numClasses = numel(classNames);

fprintf('Configured %d target classes:\n', numClasses);
disp(classNames);

% 2. Check for training data
annotMatFile = fullfile('..', 'dataset_pipeline', 'sample_training_data.mat');
if ~isfile(annotMatFile)
    fprintf('[INFO] Creating synthetic starter training dataset for pipeline verification...\n');
    % Generate mock table for syntax & workflow verification
    numSamples = 20;
    mockFilenames = cell(numSamples, 1);
    for k = 1:numSamples
        imgName = sprintf('mock_img_%03d.png', k);
        mockFilenames{k} = fullfile(pwd, 'temp_imgs', imgName);
    end
    
    if ~exist('temp_imgs', 'dir')
        mkdir('temp_imgs');
    end
    for k = 1:numSamples
        testImg = uint8(randi([0 255], [416 416 3]));
        imwrite(testImg, mockFilenames{k});
    end
    
    % Mock bounding boxes [x y w h]
    mockBoxes = repmat({[50 50 120 150; 200 100 80 180]}, numSamples, 1);
    emptyBoxes = repmat({zeros(0, 4)}, numSamples, 1);
    
    annotTable = table(mockFilenames, mockBoxes, emptyBoxes, emptyBoxes, mockBoxes, ...
                       emptyBoxes, emptyBoxes, mockBoxes, emptyBoxes, mockBoxes, ...
                       'VariableNames', ['imageFilename', classNames]);
    save(annotMatFile, 'annotTable');
end

% 3. Load Datastores
fprintf('\nLoading datasets into boxLabelDatastore...\n');
[trainingData, valData] = idd_to_boxlabeldatastore(annotMatFile, '', [0.8 0.2]);

% 4. Anchor Box Estimation
fprintf('\nEstimating anchor boxes using k-means clustering on training data...\n');
numAnchors = 6;
[anchors, meanIoU] = estimateAnchorBoxes(trainingData, numAnchors);
fprintf('Anchor boxes estimated (Mean IoU = %.2f%%)\n', meanIoU * 100);

% 5. Build YOLOv4 Detector Object with Transfer Learning
fprintf('\nConstructing YOLOv4 Object Detector with CSP-DarkNet53 backbone...\n');
try
    detector = yolov4ObjectDetector('csp-darknet53-coco', classNames, anchors, 'InputSize', inputSize);
    fprintf('[OK] Pretrained COCO weights loaded. Detector initialized.\n');
catch ME
    fprintf('[WARNING] Pretrained base download requires Deep Learning Toolbox Model for CSP-DarkNet53.\n');
    fprintf('Error details: %s\n', ME.message);
    return;
end

% 6. Configure Hyperparameters
options = trainingOptions('adam', ...
    'InitialLearnRate', 0.0005, ...
    'MiniBatchSize', 4, ...
    'MaxEpochs', 15, ...
    'BatchNormalizationStatistics', 'moving', ...
    'Shuffle', 'every-epoch', ...
    'ValidationData', valData, ...
    'ValidationFrequency', 20, ...
    'Verbose', true, ...
    'Plots', 'training-progress', ...
    'ExecutionEnvironment', 'auto'); % Uses GPU if available, falls back to CPU

% 7. Run Training
fprintf('\nStarting Fine-Tuning...\n');
[detector, info] = trainYOLOv4ObjectDetector(trainingData, detector, options);

% 8. Save Trained Model for Sensor Fusion and Simulink
outputModelPath = fullfile(pwd, 'yolov4_indian_traffic_detector.mat');
save(outputModelPath, 'detector', 'classNames', 'inputSize');
fprintf('\n[SUCCESS] Model saved to: %s\n', outputModelPath);

% 9. Evaluate Mean Average Precision (mAP)
fprintf('\nEvaluating detection metrics (mAP) on validation set...\n');
results = detect(detector, valData);
[ap, recall, precision] = evaluateDetectionPrecision(results, valData);
fprintf('Mean Average Precision (mAP): %.2f%%\n', mean(ap) * 100);
for i = 1:numClasses
    fprintf('  Class: %-15s | AP: %.2f%%\n', classNames{i}, ap(i) * 100);
end
