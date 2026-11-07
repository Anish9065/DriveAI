function [bboxes, scores, labels] = detect_objects_camera(imgInput, yoloModel)
% DETECT_OBJECTS_CAMERA Runs YOLO object detection directly on a camera image or frame
%
% Inputs:
%   imgInput  - Image file path (string/char) or uint8 RGB image matrix [H x W x 3]
%   yoloModel - (Optional) Preloaded YOLO model instance from py.ultralytics.YOLO
%
% Outputs:
%   bboxes    - [N x 4] bounding boxes in format [x y w h] (pixels)
%   scores    - [N x 1] detection confidence scores
%   labels    - Cell array of strings with predicted class names

if nargin < 2 || isempty(yoloModel)
    persistent cachedModel;
    if isempty(cachedModel)
        cachedModel = py.ultralytics.YOLO('yolov8n.pt');
    end
    yoloModel = cachedModel;
end

% Save matrix to temporary file if input is uint8 array
tempFileUsed = false;
if ~ischar(imgInput) && ~isstring(imgInput)
    tempImgPath = fullfile(tempdir, 'sih_perception_cam_frame.jpg');
    imwrite(imgInput, tempImgPath);
    imgPathStr = tempImgPath;
    tempFileUsed = true;
else
    imgPathStr = char(imgInput);
end

% Run YOLO inference
results = yoloModel.predict(imgPathStr, pyargs('verbose', false, 'conf', 0.25));

% Parse detection results
bboxes = zeros(0, 4);
scores = zeros(0, 1);
labels = {};

if ~isempty(results)
    firstRes = results{1};
    boxesObj = firstRes.boxes;
    
    numBoxes = int64(py.len(boxesObj));
    if numBoxes > 0
        xyxyData = double(boxesObj.xyxy.cpu().numpy());
        confData = double(boxesObj.conf.cpu().numpy());
        clsData  = double(boxesObj.cls.cpu().numpy());
        
        numDets = size(xyxyData, 1);
        bboxes  = zeros(numDets, 4);
        scores  = confData(:);
        labels  = cell(numDets, 1);
        
        namesDict = firstRes.names;
        
        for k = 1:numDets
            x1 = xyxyData(k, 1);
            y1 = xyxyData(k, 2);
            x2 = xyxyData(k, 3);
            y2 = xyxyData(k, 4);
            
            % Convert [x1 y1 x2 y2] to MATLAB [x y w h]
            bboxes(k, :) = [x1, y1, (x2 - x1), (y2 - y1)];
            
            clsIdx = int64(clsData(k));
            labels{k} = char(namesDict{clsIdx});
        end
    end
end

if tempFileUsed && isfile(imgPathStr)
    delete(imgPathStr);
end

end
