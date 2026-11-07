%% run_live_perception_matlab.m
% AI/ML Perception Suite - MATLAB Live Stream Runner
% Connects MATLAB to live webcam or continuous Indian road sequence.

clear; clc; close all;
fprintf('===============================================================\n');
fprintf('     MATLAB LIVE ROAD PERCEPTION & GUIDANCE SUITE             \n');
fprintf('===============================================================\n\n');

rootDir = fullfile('c:', 'Users', 'narut', 'OneDrive', 'Desktop', 'sih');
weightsPath = fullfile(rootDir, 'perception', 'models', 'runs_idd', 'idd_road_seg', 'weights', 'best.pt');
imgDir = fullfile(rootDir, 'IDD_RESIZED', 'image_archive');

if ~isfile(weightsPath)
    weightsPath = 'yolov8n-seg.pt';
end

fprintf('1. Loading YOLO Model...\n');
pyModel = py.ultralytics.YOLO(weightsPath);
fprintf('   [OK] Model loaded.\n\n');

% Check image stream
imgFiles = dir(fullfile(imgDir, 'Image_*.png'));
if isempty(imgFiles)
    error('No images found in %s', imgDir);
end

fprintf('2. Starting Live Perception Feed...\n');
fprintf('   Close the figure window to stop the stream.\n\n');

fig = figure('Name', 'MATLAB Live Perception & Guidance Stream', ...
             'Color', [0.10 0.12 0.16], ...
             'Position', [100 100 900 650]);

frameIdx = 1;
numFrames = length(imgFiles);

while ishandle(fig)
    imgPath = fullfile(imgDir, imgFiles(frameIdx).name);
    
    tic;
    pyRes = pyModel.predict(imgPath, pyargs('conf', 0.20, 'verbose', false));
    inferLatency = toc * 1000;
    
    firstRes = pyRes{1};
    annotatedArray = uint8(py.numpy.array(firstRes.plot()));
    annotatedRGB = annotatedArray(:, :, [3 2 1]);
    
    figure(fig);
    imshow(annotatedRGB);
    title(sprintf('LIVE PERCEPTION | Frame %d/%d | Latency: %.1f ms (%.1f FPS)', ...
          frameIdx, numFrames, inferLatency, 1000/inferLatency), ...
          'Color', [0.2 1.0 0.4], 'FontSize', 12, 'FontWeight', 'bold');
    
    drawnow;
    frameIdx = mod(frameIdx, numFrames) + 1;
end

fprintf('\n[INFO] Live stream stopped.\n');
