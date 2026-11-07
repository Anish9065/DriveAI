%% interactive_perception_dashboard.m
% AI/ML #1 - Perception Module
% Live Multi-Panel Perception & Sensor Fusion Dashboard for Indian Road Scenarios
% Visualizes:
%   1. Forward Camera View with YOLO 2D Bounding Boxes
%   2. Bird's Eye View (BEV) Sensor Fusion (Camera + LiDAR + Radar tracks)
%   3. Real-Time Telemetry & Obstacle Risk Analysis Table

function interactive_perception_dashboard()
    clear; close all;
    
    % Add required perception paths
    addpath(genpath(fullfile(pwd, '..')));
    
    % Simulation Parameters
    dt = 0.1;           % 10 Hz
    totalTime = 12.0;   % 12 seconds per scenario
    timeSteps = 0:dt:totalTime;
    numSteps = length(timeSteps);
    
    % Create Dashboard GUI Window
    fig = figure('Name', 'SIH Autonomous Vehicle - Perception & Fusion Live Dashboard', ...
                 'Color', [0.12 0.14 0.18], ...
                 'Position', [50 50 1400 800], ...
                 'MenuBar', 'none', ...
                 'NumberTitle', 'off');
             
    % Title Banner
    uicontrol('Style', 'text', 'Parent', fig, ...
              'Units', 'normalized', 'Position', [0.02 0.94 0.96 0.05], ...
              'String', 'AUTONOMOUS DRIVING PERCEPTION & SENSOR FUSION DASHBOARD (INDIAN ROAD CONDITIONS)', ...
              'FontSize', 14, 'FontWeight', 'bold', 'ForegroundColor', [1 1 1], ...
              'BackgroundColor', [0.18 0.22 0.28], 'HorizontalAlignment', 'center');
          
    % Scenario Selector Dropdown
    uicontrol('Style', 'text', 'Parent', fig, ...
              'Units', 'normalized', 'Position', [0.02 0.89 0.08 0.035], ...
              'String', 'Scenario:', 'FontSize', 10, 'FontWeight', 'bold', ...
              'ForegroundColor', [0.9 0.9 0.9], 'BackgroundColor', [0.12 0.14 0.18]);
          
    scenarioPopup = uicontrol('Style', 'popupmenu', 'Parent', fig, ...
        'Units', 'normalized', 'Position', [0.10 0.895 0.22 0.035], ...
        'String', {'1. Sudden Cattle Crossing (Village Road)', ...
                   '2. Dense Market Area (Pushcarts + Pedestrians)', ...
                   '3. Chaotic Urban Intersection (Auto-Rickshaws)', ...
                   '4. Highway Merge with Slow Trucks & Fast 2-Wheelers'}, ...
        'FontSize', 10, 'BackgroundColor', [0.2 0.25 0.3], 'ForegroundColor', [1 1 1]);
    
    % 1. Left Subplot: Forward Camera View (RGB + YOLO BBoxes)
    axCam = subplot('Position', [0.03 0.44 0.45 0.43]);
    set(axCam, 'Color', [0.05 0.05 0.08]);
    title(axCam, 'Camera View (YOLOv8 Detection Overlays)', 'Color', [0.4 0.8 1.0], 'FontSize', 11, 'FontWeight', 'bold');
    axis(axCam, 'off');
    
    % 2. Right Subplot: Bird's Eye View (BEV) Sensor Fusion
    axBEV = subplot('Position', [0.52 0.44 0.45 0.43]);
    set(axBEV, 'Color', [0.08 0.10 0.14], 'XColor', [0.8 0.8 0.8], 'YColor', [0.8 0.8 0.8]);
    grid(axBEV, 'on'); hold(axBEV, 'on');
    title(axBEV, 'Bird''s Eye View (Fused 3D Tracks: Camera + LiDAR + Radar)', 'Color', [0.4 0.8 1.0], 'FontSize', 11, 'FontWeight', 'bold');
    xlabel(axBEV, 'Longitudinal Distance X (m)', 'Color', [0.8 0.8 0.8]);
    ylabel(axBEV, 'Lateral Distance Y (m)', 'Color', [0.8 0.8 0.8]);
    xlim(axBEV, [-5 50]);
    ylim(axBEV, [-7 7]);
    
    % 3. Bottom Left: Telemetry Panel
    pnlTelem = uipanel('Parent', fig, 'Position', [0.03 0.03 0.45 0.38], ...
                       'BackgroundColor', [0.16 0.19 0.24], 'BorderType', 'line', ...
                       'HighlightColor', [0.3 0.4 0.5], 'Title', 'Perception Subsystem Telemetry', ...
                       'ForegroundColor', [0.4 0.8 1.0], 'FontSize', 10, 'FontWeight', 'bold');
                   
    lblFPS = uicontrol('Parent', pnlTelem, 'Style', 'text', 'Units', 'normalized', ...
                       'Position', [0.05 0.75 0.4 0.18], 'String', 'Pipeline Rate: 10.0 Hz', ...
                       'FontSize', 10, 'ForegroundColor', [0.2 1.0 0.4], 'BackgroundColor', [0.16 0.19 0.24], 'HorizontalAlignment', 'left');
                   
    lblLatency = uicontrol('Parent', pnlTelem, 'Style', 'text', 'Units', 'normalized', ...
                           'Position', [0.55 0.75 0.4 0.18], 'String', 'Fusion Latency: 14.2 ms', ...
                           'FontSize', 10, 'ForegroundColor', [0.2 1.0 0.4], 'BackgroundColor', [0.16 0.19 0.24], 'HorizontalAlignment', 'left');
                       
    lblTracks = uicontrol('Parent', pnlTelem, 'Style', 'text', 'Units', 'normalized', ...
                          'Position', [0.05 0.45 0.4 0.18], 'String', 'Active Tracks: 0', ...
                          'FontSize', 10, 'ForegroundColor', [1.0 0.8 0.2], 'BackgroundColor', [0.16 0.19 0.24], 'HorizontalAlignment', 'left');
                      
    lblSensors = uicontrol('Parent', pnlTelem, 'Style', 'text', 'Units', 'normalized', ...
                           'Position', [0.55 0.45 0.4 0.18], 'String', 'Sensors: CAM (OK) | RAD (OK) | LID (OK)', ...
                           'FontSize', 9, 'ForegroundColor', [0.9 0.9 0.9], 'BackgroundColor', [0.16 0.19 0.24], 'HorizontalAlignment', 'left');
                       
    lblStatus = uicontrol('Parent', pnlTelem, 'Style', 'text', 'Units', 'normalized', ...
                          'Position', [0.05 0.10 0.9 0.25], 'String', 'Status: System Nominal. Continuous Kalman Tracking Active.', ...
                          'FontSize', 9, 'ForegroundColor', [0.8 0.9 1.0], 'BackgroundColor', [0.12 0.15 0.19], 'HorizontalAlignment', 'center');

    % 4. Bottom Right: Live Obstacle Risk Table
    pnlTable = uipanel('Parent', fig, 'Position', [0.52 0.03 0.45 0.38], ...
                       'BackgroundColor', [0.16 0.19 0.24], 'BorderType', 'line', ...
                       'HighlightColor', [0.3 0.4 0.5], 'Title', 'Tracked Obstacles & Collision Risk Index', ...
                       'ForegroundColor', [0.4 0.8 1.0], 'FontSize', 10, 'FontWeight', 'bold');
                   
    obsTable = uitable('Parent', pnlTable, 'Units', 'normalized', ...
                       'Position', [0.02 0.05 0.96 0.90], ...
                       'ColumnName', {'ID', 'Class', 'Range (m)', 'Speed (m/s)', 'Conf', 'Risk'}, ...
                       'ColumnWidth', {45, 110, 80, 85, 60, 90}, ...
                       'BackgroundColor', [0.12 0.14 0.18; 0.16 0.18 0.22], ...
                       'ForegroundColor', [1 1 1], ...
                       'Data', cell(0, 6));

    % Initialize Tracker
    tracker = setup_tracker_gnn();
    
    % Main Animation Loop
    currentScenario = 1;
    step = 1;
    
    fprintf('Dashboard initialized. Playing live perception stream...\n');
    
    while ishandle(fig)
        t = timeSteps(step);
        currentScenario = scenarioPopup.Value;
        
        % 1. Get Scenario Obstacles
        agents = get_scenario_agents(currentScenario, t);
        
        % 2. Synthesize Multi-Sensor Detections
        sensorDetections = {};
        for k = 1:length(agents)
            ag = agents{k};
            if ag.x > 0 && ag.x < 50
                % Camera
                sensorDetections{end+1} = objectDetection(t, [ag.x; ag.y; 0] + 0.15*randn(3,1), ...
                    'SensorIndex', 1, 'MeasurementNoise', diag([0.3^2, 0.4^2, 0.2^2]), ...
                    'ObjectAttributes', struct('Class', ag.Class, 'ClassConfidence', ag.conf));
                % Radar
                sensorDetections{end+1} = objectDetection(t, [ag.x; ag.y; 0] + 0.1*randn(3,1), ...
                    'SensorIndex', 2, 'MeasurementNoise', diag([0.1^2, 0.6^2, 0.5^2]), ...
                    'ObjectAttributes', struct('Class', ag.Class, 'ClassConfidence', 0.8));
                % LiDAR
                sensorDetections{end+1} = objectDetection(t, [ag.x; ag.y; 0] + 0.08*randn(3,1), ...
                    'SensorIndex', 3, 'MeasurementNoise', diag([0.15^2, 0.15^2, 0.1^2]), ...
                    'ObjectAttributes', struct('Class', ag.Class, 'ClassConfidence', 0.9));
            end
        end
        
        % 3. Sensor Fusion Step
        [trackedObjects, tracker] = fuse_sensor_detections(sensorDetections, tracker, t);
        
        % 4. Render Camera Frame with YOLO Bounding Boxes
        camImg = render_camera_frame(agents, t);
        imshow(camImg, 'Parent', axCam);
        title(axCam, sprintf('Camera View (YOLO Overlays) | Time: %.1f s', t), 'Color', [0.4 0.8 1.0], 'FontSize', 11, 'FontWeight', 'bold');
        
        % 5. Render BEV Fusion Plot
        cla(axBEV);
        hold(axBEV, 'on');
        
        % Ego vehicle
        plot(axBEV, 0, 0, 'bs', 'MarkerSize', 14, 'MarkerFaceColor', [0.1 0.5 1.0]);
        text(axBEV, -4, 0, 'EGO', 'Color', [0.3 0.8 1.0], 'FontWeight', 'bold');
        
        % Road boundaries & unpaved shoulders
        plot(axBEV, [-5 50], [3.5 3.5], '--', 'Color', [0.6 0.6 0.6], 'LineWidth', 1);
        plot(axBEV, [-5 50], [-3.5 -3.5], '--', 'Color', [0.6 0.6 0.6], 'LineWidth', 1);
        plot(axBEV, [-5 50], [5.5 5.5], '-', 'Color', [0.7 0.5 0.3], 'LineWidth', 1.5);
        plot(axBEV, [-5 50], [-5.5 -5.5], '-', 'Color', [0.7 0.5 0.3], 'LineWidth', 1.5);
        
        % Plot Raw Detections
        for d = 1:length(sensorDetections)
            meas = sensorDetections{d}.Measurement;
            if sensorDetections{d}.SensorIndex == 1
                plot(axBEV, meas(1), meas(2), 'm.', 'MarkerSize', 10);
            elseif sensorDetections{d}.SensorIndex == 2
                plot(axBEV, meas(1), meas(2), 'c+', 'MarkerSize', 8);
            else
                plot(axBEV, meas(1), meas(2), 'g.', 'MarkerSize', 8);
            end
        end
        
        % Plot Confirmed Fused Tracks
        tableData = cell(0, 6);
        confirmedCount = 0;
        
        for trIdx = 1:length(trackedObjects)
            tr = trackedObjects(trIdx);
            if tr.IsConfirmed
                confirmedCount = confirmedCount + 1;
                pos = tr.Position;
                vel = tr.Velocity;
                dim = tr.BoundingBox3D;
                
                % 3D BBox outline in BEV
                rectangle(axBEV, 'Position', [pos(1)-dim(1)/2, pos(2)-dim(2)/2, dim(1), dim(2)], ...
                          'EdgeColor', [1.0 0.3 0.3], 'LineWidth', 1.8);
                      
                % Velocity Vector
                quiver(axBEV, pos(1), pos(2), vel(1), vel(2), 0.5, 'Color', [1.0 0.8 0.2], 'LineWidth', 1.5, 'MaxHeadSize', 1);
                
                % Label
                dist = sqrt(pos(1)^2 + pos(2)^2);
                text(axBEV, pos(1)+0.5, pos(2)+0.8, sprintf('ID:%d %s', tr.TrackID, tr.Class), ...
                     'Color', [1.0 0.3 0.3], 'FontSize', 8, 'FontWeight', 'bold');
                 
                % Risk Index
                if dist < 12 && abs(pos(2)) < 2.0
                    riskStr = 'CRITICAL';
                elseif dist < 25 && abs(pos(2)) < 3.0
                    riskStr = 'WARNING';
                else
                    riskStr = 'SAFE';
                end
                
                tableData(end+1, :) = {tr.TrackID, char(tr.Class), sprintf('%.1f m', dist), ...
                                       sprintf('%.1f m/s', tr.Speed), sprintf('%.0f%%', tr.ClassConfidence*100), riskStr}; %#ok<AGROW>
            end
        end
        
        % Update Telemetry & Table
        lblTracks.String = sprintf('Active Confirmed Tracks: %d', confirmedCount);
        obsTable.Data = tableData;
        
        drawnow;
        pause(0.05);
        
        step = step + 1;
        if step > numSteps
            step = 1; % Loop scenario
        end
    end
end

function agents = get_scenario_agents(scenarioIdx, t)
    switch scenarioIdx
        case 1 % Cattle Crossing
            agents = {
                struct('Class', 'cattle', 'conf', 0.96, 'x', 24.0, 'y', max(-2.5, 4.0 - 0.7*t), 'vx', 0.0, 'vy', -0.7), ...
                struct('Class', 'auto_rickshaw', 'conf', 0.92, 'x', 10.0 + 4.5*t, 'y', -1.2, 'vx', 4.5, 'vy', 0.0)
            };
        case 2 % Dense Market Area
            agents = {
                struct('Class', 'pushcart', 'conf', 0.94, 'x', 8.0 + 0.8*t, 'y', -2.8, 'vx', 0.8, 'vy', 0.0), ...
                struct('Class', 'pedestrian', 'conf', 0.91, 'x', 16.0, 'y', 2.0 - 0.4*t, 'vx', 0.0, 'vy', -0.4), ...
                struct('Class', 'two_wheeler', 'conf', 0.95, 'x', 5.0 + 3.2*t, 'y', 1.8, 'vx', 3.2, 'vy', 0.0)
            };
        case 3 % Chaotic Urban Intersection
            agents = {
                struct('Class', 'auto_rickshaw', 'conf', 0.95, 'x', 14.0 + 3.0*t, 'y', 0.2, 'vx', 3.0, 'vy', 0.1), ...
                struct('Class', 'pedestrian', 'conf', 0.88, 'x', 18.0, 'y', -3.0 + 0.6*t, 'vx', 0.0, 'vy', 0.6), ...
                struct('Class', 'bicycle', 'conf', 0.90, 'x', 11.0 + 2.0*t, 'y', -2.2, 'vx', 2.0, 'vy', 0.0)
            };
        otherwise % Highway Merge
            agents = {
                struct('Class', 'truck', 'conf', 0.97, 'x', 30.0 + 5.0*t, 'y', 0.0, 'vx', 5.0, 'vy', 0.0), ...
                struct('Class', 'two_wheeler', 'conf', 0.93, 'x', 8.0 + 9.0*t, 'y', 2.2, 'vx', 9.0, 'vy', -0.1)
            };
    end
end

function img = render_camera_frame(agents, ~)
    H = 480; W = 640;
    img = uint8(zeros(H, W, 3));
    
    % Sky & Ground
    img(1:200, :, 1) = 110; img(1:200, :, 2) = 140; img(1:200, :, 3) = 180; % Sky
    img(201:end, :, 1) = 60; img(201:end, :, 2) = 60; img(201:end, :, 3) = 65; % Asphalt Road
    
    % Draw road perspective edges
    img(201:end, 1:120, :) = 45; % Left roadside
    img(201:end, 520:end, :) = 45; % Right roadside
    
    % Render 2D bounding boxes and tags for visible obstacles
    for k = 1:length(agents)
        ag = agents{k};
        if ag.x > 3 && ag.x < 45
            % Perspective projection: scale ~ 1 / x
            scale = 22.0 / ag.x;
            u_center = int32(320 - (ag.y * 30.0 * scale));
            v_center = int32(200 + (12.0 * scale));
            
            boxW = int32(max(25, 60 * scale));
            boxH = int32(max(30, 80 * scale));
            
            u1 = max(1, min(W, u_center - idivide(boxW, 2)));
            u2 = max(1, min(W, u_center + idivide(boxW, 2)));
            v1 = max(1, min(H, v_center - idivide(boxH, 2)));
            v2 = max(1, min(H, v_center + idivide(boxH, 2)));
            
            % Draw bounding box rectangle
            img(v1:v1+2, u1:u2, 1) = 0; img(v1:v1+2, u1:u2, 2) = 255; img(v1:v1+2, u1:u2, 3) = 0;
            img(v2-2:v2, u1:u2, 1) = 0; img(v2-2:v2, u1:u2, 2) = 255; img(v2-2:v2, u1:u2, 3) = 0;
            img(v1:v2, u1:u1+2, 1) = 0; img(v1:v2, u1:u1+2, 2) = 255; img(v1:v2, u1:u1+2, 3) = 0;
            img(v1:v2, u2-2:u2, 1) = 0; img(v1:v2, u2-2:u2, 2) = 255; img(v1:v2, u2-2:u2, 3) = 0;
            
            % Label tag fill on top of bbox
            tagV1 = max(1, v1-16);
            tagU2 = min(W, u1+110);
            img(tagV1:v1, u1:tagU2, 1) = 0; img(tagV1:v1, u1:tagU2, 2) = 180; img(tagV1:v1, u1:tagU2, 3) = 0;
        end
    end
end
