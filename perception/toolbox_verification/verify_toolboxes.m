%% verify_toolboxes.m
% AI/ML #1 - Perception Module
% Verification script for required MATLAB toolboxes and GPU acceleration

fprintf('====================================================\n');
fprintf('  SIH Autonomous Driving - Perception Toolbox Check  \n');
fprintf('====================================================\n\n');

requiredToolboxes = {
    'Computer Vision Toolbox', ...
    'Deep Learning Toolbox', ...
    'Automated Driving Toolbox', ...
    'Sensor Fusion and Tracking Toolbox', ...
    'Navigation Toolbox', ...
    'ROS Toolbox' % Optional
};

installedVer = ver;
installedNames = {installedVer.Name};

fprintf('--- Toolbox Availability Check ---\n');
allMandatoryInstalled = true;

for i = 1:length(requiredToolboxes)
    tBox = requiredToolboxes{i};
    isFound = any(strcmp(installedNames, tBox));
    if isFound
        idx = find(strcmp(installedNames, tBox), 1);
        fprintf('[OK] %s (Version %s)\n', tBox, installedVer(idx).Version);
    else
        if strcmp(tBox, 'ROS Toolbox')
            fprintf('[OPTIONAL MISSING] %s\n', tBox);
        else
            fprintf('[MISSING] %s\n', tBox);
            allMandatoryInstalled = false;
        end
    end
end

fprintf('\n--- GPU Acceleration Check ---\n');
try
    gpuAvailable = canUseGPU();
    if gpuAvailable
        gpuInfo = gpuDevice();
        fprintf('[OK] GPU detected: %s (Compute Capability: %s, Total Memory: %.2f GB)\n', ...
            gpuInfo.Name, gpuInfo.ComputeCapability, gpuInfo.TotalMemory / (1024^3));
    else
        fprintf('[WARNING] No CUDA-enabled GPU detected for MATLAB. Deep learning operations will run on CPU.\n');
    end
catch
    fprintf('[INFO] GPU checking skipped / CPU fallback active.\n');
end

fprintf('\n====================================================\n');
if allMandatoryInstalled
    fprintf('SUCCESS: All essential perception toolboxes are ready.\n');
else
    fprintf('ACTION REQUIRED: Please install missing mandatory toolboxes using MATLAB Add-On Explorer.\n');
end
fprintf('====================================================\n');
