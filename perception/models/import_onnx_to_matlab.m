%% import_onnx_to_matlab.m
% AI/ML #1 - Perception Module
% Imports an ONNX model exported from YOLO into MATLAB and wraps it for inference

function [net, classNames] = import_onnx_to_matlab(onnxFilePath)

if nargin < 1
    onnxFilePath = 'indian_traffic_yolov8.onnx';
end

classNames = {'car', 'bus', 'truck', 'auto_rickshaw', 'two_wheeler', ...
              'bicycle', 'pedestrian', 'pushcart', 'cattle'};

if ~isfile(onnxFilePath)
    warning('ONNX file "%s" not found. Please provide a valid path or export from train_yolov8_ultralytics.py.', onnxFilePath);
    net = [];
    return;
end

fprintf('Importing ONNX model from: %s\n', onnxFilePath);
try
    net = importNetworkFromONNX(onnxFilePath);
    fprintf('[OK] Network successfully imported into MATLAB Deep Learning Toolbox.\n');
catch ME
    fprintf('[ERROR] Failed to import ONNX model: %s\n', ME.message);
    net = [];
end

end
