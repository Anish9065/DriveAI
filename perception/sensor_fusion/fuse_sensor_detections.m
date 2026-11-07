function [trackedObjects, tracker] = fuse_sensor_detections(sensorDetections, tracker, currentTime)
% FUSE_SENSOR_DETECTIONS Fuses Camera, Radar, and LiDAR detections using the tracker
%
% Inputs:
%   sensorDetections - Cell array of objectDetection objects from all sensors
%   tracker          - trackerGNN or trackerJPDA instance
%   currentTime      - Simulation timestamp (seconds)
%
% Outputs:
%   trackedObjects   - Array of standardized TrackedObject structs
%   tracker          - Updated tracker object

if isempty(tracker)
    tracker = setup_tracker_gnn();
end

if nargin < 3
    currentTime = 0;
    if ~isempty(sensorDetections) && isprop(sensorDetections{1}, 'Time')
        currentTime = sensorDetections{1}.Time;
    end
end

% Step 1: Update tracker with current detections
if isempty(sensorDetections)
    if isLocked(tracker)
        tracks = tracker(cell(0, 1), currentTime);
    else
        tracks = repmat(objectTrack, 0, 1);
    end
else
    tracks = tracker(sensorDetections, currentTime);
end

% Step 2: Convert internal tracks to standardized TrackedObject structs
numTracks = length(tracks);
trackedObjects = repmat(create_empty_tracked_object(), numTracks, 1);

for i = 1:numTracks
    tr = tracks(i);
    
    % State vector: [x; vx; y; vy; z; vz]
    x_pos = tr.State(1);
    vx    = tr.State(2);
    y_pos = tr.State(3);
    vy    = tr.State(4);
    z_pos = tr.State(5);
    vz    = tr.State(6);
    
    trackedObjects(i).TrackID = uint32(tr.TrackID);
    trackedObjects(i).Position = [x_pos, y_pos, z_pos];
    trackedObjects(i).Velocity = [vx, vy, vz];
    trackedObjects(i).Speed = sqrt(vx^2 + vy^2 + vz^2);
    trackedObjects(i).Heading = atan2d(vy, vx); % In degrees
    
    % Extract class label and confidence if passed in ObjectAttributes
    className = "unknown";
    confidence = 1.0;
    dims = [];
    if isstruct(tr.ObjectAttributes) && ~isempty(tr.ObjectAttributes)
        if isfield(tr.ObjectAttributes, 'Class')
            val = tr.ObjectAttributes(1).Class;
            if ischar(val) || isstring(val)
                className = string(val);
            elseif iscell(val) && ~isempty(val)
                className = string(val{1});
            end
        end
        if isfield(tr.ObjectAttributes, 'ClassConfidence') && ~isempty(tr.ObjectAttributes(1).ClassConfidence)
            confidence = double(tr.ObjectAttributes(1).ClassConfidence);
        end
        if isfield(tr.ObjectAttributes, 'Dimensions') && ~isempty(tr.ObjectAttributes(1).Dimensions)
            dims = double(tr.ObjectAttributes(1).Dimensions);
        end
    end
    
    trackedObjects(i).Class = className;
    trackedObjects(i).ClassConfidence = confidence;
    if isempty(dims)
        trackedObjects(i).BoundingBox3D = get_default_dimensions(className);
    else
        trackedObjects(i).BoundingBox3D = dims;
    end
    
    trackedObjects(i).Covariance = tr.StateCovariance;
    trackedObjects(i).IsConfirmed = tr.IsConfirmed;
    trackedObjects(i).Age = tr.Age;
end

end

function obj = create_empty_tracked_object()
obj = struct(...
    'TrackID', uint32(0), ...
    'Class', "unknown", ...
    'ClassConfidence', 0.0, ...
    'Position', [0.0, 0.0, 0.0], ...
    'Velocity', [0.0, 0.0, 0.0], ...
    'Speed', 0.0, ...
    'Heading', 0.0, ...
    'BoundingBox3D', [0.0, 0.0, 0.0], ...
    'Covariance', zeros(6, 6), ...
    'IsConfirmed', false, ...
    'Age', uint32(0));
end

function dims = get_default_dimensions(className)
% Standard 3D bounding box dimensions [Length, Width, Height] in meters
switch lower(char(className))
    case 'auto_rickshaw'
        dims = [2.6, 1.3, 1.7];
    case 'car'
        dims = [4.5, 1.8, 1.5];
    case 'bus'
        dims = [10.5, 2.5, 3.2];
    case 'truck'
        dims = [8.0, 2.4, 3.0];
    case 'two_wheeler'
        dims = [1.8, 0.7, 1.2];
    case 'bicycle'
        dims = [1.6, 0.5, 1.1];
    case 'pedestrian'
        dims = [0.5, 0.5, 1.7];
    case 'pushcart'
        dims = [1.8, 1.2, 1.4];
    case 'cattle'
        dims = [2.2, 0.9, 1.5];
    otherwise
        dims = [2.0, 1.5, 1.5];
end
end
