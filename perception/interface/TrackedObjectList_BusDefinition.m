function TrackedObjectList_BusDefinition()
% TrackedObjectList_BusDefinition
% Creates Simulink Bus Objects in the MATLAB base workspace for:
% 1. TrackedObject_Bus
% 2. TrackedObjectList_Bus
%
% This allows Full-Stack #1 and AI/ML #2 to use these buses directly in Simulink models.

% 1. Create TrackedObject_Bus
elems(1) = Simulink.BusElement;
elems(1).Name = 'TrackID';
elems(1).DataType = 'uint32';
elems(1).Dimensions = 1;

elems(2) = Simulink.BusElement;
elems(2).Name = 'ClassID'; % 1: car, 2: bus, 3: truck, 4: auto_rickshaw, 5: two_wheeler, 6: bicycle, 7: pedestrian, 8: pushcart, 9: cattle
elems(2).DataType = 'uint8';
elems(2).Dimensions = 1;

elems(3) = Simulink.BusElement;
elems(3).Name = 'ClassConfidence';
elems(3).DataType = 'single';
elems(3).Dimensions = 1;

elems(4) = Simulink.BusElement;
elems(4).Name = 'Position'; % [X, Y, Z] in meters (ISO 8855 Ego Vehicle coordinates: X forward, Y left, Z up)
elems(4).DataType = 'single';
elems(4).Dimensions = [1 3];

elems(5) = Simulink.BusElement;
elems(5).Name = 'Velocity'; % [Vx, Vy, Vz] in m/s
elems(5).DataType = 'single';
elems(5).Dimensions = [1 3];

elems(6) = Simulink.BusElement;
elems(6).Name = 'Speed'; % Magnitude in m/s
elems(6).DataType = 'single';
elems(6).Dimensions = 1;

elems(7) = Simulink.BusElement;
elems(7).Name = 'Heading'; % Heading angle in degrees
elems(7).DataType = 'single';
elems(7).Dimensions = 1;

elems(8) = Simulink.BusElement;
elems(8).Name = 'BoundingBox3D'; % [Length, Width, Height] in meters
elems(8).DataType = 'single';
elems(8).Dimensions = [1 3];

elems(9) = Simulink.BusElement;
elems(9).Name = 'IsConfirmed';
elems(9).DataType = 'boolean';
elems(9).Dimensions = 1;

elems(10) = Simulink.BusElement;
elems(10).Name = 'Age';
elems(10).DataType = 'uint32';
elems(10).Dimensions = 1;

TrackedObject_Bus = Simulink.Bus;
TrackedObject_Bus.Elements = elems;
assignin('base', 'TrackedObject_Bus', TrackedObject_Bus);

% 2. Create TrackedObjectList_Bus (Fixed maximum of 30 simultaneous obstacles)
maxObjects = 30;
listElems(1) = Simulink.BusElement;
listElems(1).Name = 'NumObjects';
listElems(1).DataType = 'uint32';
listElems(1).Dimensions = 1;

listElems(2) = Simulink.BusElement;
listElems(2).Name = 'Timestamp';
listElems(2).DataType = 'double';
listElems(2).Dimensions = 1;

listElems(3) = Simulink.BusElement;
listElems(3).Name = 'Objects';
listElems(3).DataType = 'Bus: TrackedObject_Bus';
listElems(3).Dimensions = [1 maxObjects];

TrackedObjectList_Bus = Simulink.Bus;
TrackedObjectList_Bus.Elements = listElems;
assignin('base', 'TrackedObjectList_Bus', TrackedObjectList_Bus);

fprintf('[SUCCESS] TrackedObject_Bus & TrackedObjectList_Bus created in MATLAB Base Workspace.\n');
end
