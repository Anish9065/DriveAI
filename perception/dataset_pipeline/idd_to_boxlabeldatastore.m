function [trainingData, valData, classNames] = idd_to_boxlabeldatastore(annotationFilePath, imagesDir, splitRatio)
% IDD_TO_BOXLABELDATASTORE Converts IDD/Custom annotations into MATLAB boxLabelDatastore
%
% Inputs:
%   annotationFilePath - Path to MAT, CSV or JSON containing annotation table
%   imagesDir          - Path to image directory containing the corresponding images
%   splitRatio         - [trainRatio valRatio], e.g., [0.8 0.2]
%
% Outputs:
%   trainingData       - Combined datastore (imageDatastore + boxLabelDatastore) for training
%   valData            - Combined datastore for validation/testing
%   classNames         - Cell array of string class names

if nargin < 3
    splitRatio = [0.8 0.2];
end

classNames = {'car', 'bus', 'truck', 'auto_rickshaw', 'two_wheeler', ...
              'bicycle', 'pedestrian', 'pushcart', 'cattle'};

fprintf('Loading annotations from: %s\n', annotationFilePath);

if endsWith(annotationFilePath, '.mat')
    data = load(annotationFilePath);
    if isfield(data, 'annotationsTable')
        annotTable = data.annotationsTable;
    else
        error('MAT file must contain an "annotationsTable" variable.');
    end
elseif endsWith(annotationFilePath, '.csv')
    annotTable = readtable(annotationFilePath);
else
    error('Unsupported file format. Please provide .mat or .csv annotation table.');
end

% Ensure image paths are absolute or prefixed with imagesDir
if ~isempty(imagesDir)
    for i = 1:height(annotTable)
        if ~isfile(annotTable.imageFilename{i})
            fullImgPath = fullfile(imagesDir, annotTable.imageFilename{i});
            if isfile(fullImgPath)
                annotTable.imageFilename{i} = fullImgPath;
            end
        end
    end
end

% Split into train and validation sets
numRows = height(annotTable);
rng(42); % For reproducibility
shuffledIndices = randperm(numRows);
numTrain = floor(splitRatio(1) * numRows);

trainIndices = shuffledIndices(1:numTrain);
valIndices = shuffledIndices(numTrain+1:end);

trainTable = annotTable(trainIndices, :);
valTable = annotTable(valIndices, :);

% Create Image Datastores
imdsTrain = imageDatastore(trainTable.imageFilename);
imdsVal = imageDatastore(valTable.imageFilename);

% Create Box Label Datastores (assuming columns 2:end match classNames)
bldsTrain = boxLabelDatastore(trainTable(:, classNames));
bldsVal = boxLabelDatastore(valTable(:, classNames));

% Combine datastores
trainingData = combine(imdsTrain, bldsTrain);
valData = combine(imdsVal, bldsVal);

fprintf('Datastores created successfully:\n');
fprintf('  Total samples: %d\n', numRows);
fprintf('  Training samples: %d\n', numTrain);
fprintf('  Validation samples: %d\n', numRows - numTrain);
fprintf('  Classes (%d): %s\n', length(classNames), strjoin(classNames, ', '));

end
