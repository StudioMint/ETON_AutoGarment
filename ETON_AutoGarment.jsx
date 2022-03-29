#target photoshop
var scriptFolder = (new File($.fileName)).parent; // The location of this script

// Keeping the ruler settings to reset in the end of the script
var startRulerUnits = app.preferences.rulerUnits;
var startTypeUnits = app.preferences.typeUnits;
var startDisplayDialogs = app.displayDialogs;

// Changing ruler settings to pixels for correct image resizing
app.preferences.rulerUnits = Units.PIXELS;
app.preferences.typeUnits = TypeUnits.PIXELS;
app.displayDialogs = DialogModes.NO;

// VARIABLES

var lyr_GrpSamplesGarm, lyr_SamplerCheck, lyr_FillAuto;

var minimumFilter = 100; // Expansion with Minimum
var caCrossSize = 30; // Content aware square size
var vibranceLyr = true; // Creates a Vibrance layer instead of desaturate()
var gradientSteps = 5; // Max 5
var brightnessSteps = 1; // Max 3 (Max 1 atm bcuz tricky..)

var samplesArrayRGB = [];
var samplesArrayBrightness = [];
var samplesRef = [];
var samplesRefBrightness = [];
var samplesGarm = [];
var samplesGarmBrightness = [];
var spanWeightGarm = [];
var spanWeightRef = [];
var grp_Garment;
var grp_Ref;
var garmentType = undefined;
var cleanRGB;
var blendIfSpan;
var blendIfSpanBrightness = Math.round(255 / brightnessSteps);
var brightnessBlendCap = 0;
var garmentSize; // 0.0-1.0 - If 0.0 then garment bounds fill the whole canvas
var refSize;
var refAngle;
var addVibrance = false;
var addAdditional = false;

var troubleshoot = false;
var showEndMatchRef = false;
var saveJpgCheckFile = true;
var skipPopulated = true;
var errorLog = [];

try {
    init();
    if (errorLog.length > 0) alert(errorLog);
} catch(e) {
    alert("Error code " + e.number + " (line " + e.line + "):\n" + e);
}

// Reset the ruler
app.preferences.rulerUnits = startRulerUnits;
app.preferences.typeUnits = startTypeUnits;
app.displayDialogs = startDisplayDialogs;

function init() {

    //gradientSteps = parseInt(prompt("Gradient steps:", "4"));
    blendIfSpan = Math.round(255 / gradientSteps);
    
    // Preparation before running the main script
    try {
        activeDocument.activeLayer = activeDocument.layers.getByName("Group 1").layerSets.getByName("Garment");
        grp_Garment = activeDocument.activeLayer.layerSets.add();
        grp_Garment.name = "Scripted matching";
    } catch(e) {
        errorLog.push(activeDocument.name + ": No Garment group found");
        return;
        // return alert("No Garment group found");
    }
    try {
        activeDocument.activeLayer = activeDocument.layers.getByName("Garment Colour Match");
        grp_Ref = activeDocument.activeLayer;
    } catch(e) {
        errorLog.push(activeDocument.name + ": No Garment Colour Match group found");
        return;
        // return alert("No Garment Colour Match group found");
    }

    if (grp_Garment.layers.length != 0 && skipPopulated) {
        if (saveJpgCheckFile) {
            grp_Ref.visible = true;
            var jpgDir = new Folder(activeDocument.path + "/_MatchCheck");
            saveAsJPG(jpgDir, activeDocument.name.substring(0, activeDocument.name.lastIndexOf(".")));
            grp_Ref.visible = showEndMatchRef;
        }
        return;
    }
    
    if (grp_Garment.layers.length != 0) {
        for (i = 0; i < grp_Garment.layers.length; i++) {
            grp_Garment.layers[i].visible = false;
        }
    }
    
    switch (grp_Ref.layers[0].name.substring(0, 3)) {
        case "tsh": garmentType = "shirt"; break;
        case "tss": garmentType = "shorts"; break;
    }
    refAngle = grp_Ref.layers[0].name;
    
    activeDocument.activeLayer = grp_Garment.parent;
    selectionFromMask();
    var pixelsWidth = activeDocument.selection.bounds[2].value - activeDocument.selection.bounds[0].value;
    var pixelsHeight = activeDocument.selection.bounds[3].value - activeDocument.selection.bounds[1].value;
    var pixelsArea = pixelsWidth * pixelsHeight;
    garmentSize = 1 - (pixelsArea / (activeDocument.width.value * activeDocument.height.value));
    activeDocument.selection.deselect();
    
    activeDocument.colorSamplers.removeAll();

    main();

}

function main() {

    ///////////////////////////
    ///////// CUTOUTS /////////
    ///////////////////////////
    
    // ----- Create cutout for ref -----
    grp_Ref.visible = true;
    activeDocument.activeLayer = grp_Ref.layers[0];
    activeDocument.activeLayer.visible = true;
    var lyrHeightInPt = activeDocument.activeLayer.bounds[3].as('pt') - activeDocument.activeLayer.bounds[1].as('pt');
    var lyrWidthInPt = activeDocument.activeLayer.bounds[2].as('pt') - activeDocument.activeLayer.bounds[0].as('pt');
        
    // Select Subject
    selectSubject(false);
    activeDocument.selection.contract(new UnitValue (30, "px"));
    // Adjust selection
    switch (garmentType) {
        case "shirt":
            if (refAngle == "tshov_1") {
                makePointSelection([[0, 0],[activeDocument.width.as('pt'), 0],[activeDocument.width.as('pt'), lyrHeightInPt / 3 + activeDocument.activeLayer.bounds[1].as('pt')], [0, lyrHeightInPt / 3 + activeDocument.activeLayer.bounds[1].as('pt')]], 0, SelectionType.DIMINISH);
                makePointSelection([[0, ((lyrHeightInPt / 3) * 2) + activeDocument.activeLayer.bounds[1].as('pt')],[((lyrWidthInPt / 5) * 2.2) + activeDocument.activeLayer.bounds[0].as('pt'), ((lyrHeightInPt / 3) * 2) + activeDocument.activeLayer.bounds[1].as('pt')],[((lyrWidthInPt / 5) * 2.2) + activeDocument.activeLayer.bounds[1].as('pt'), activeDocument.height.as('pt')], [0, activeDocument.height.as('pt')]], 0, SelectionType.DIMINISH);
            }
            break;
    }

    var pixelsWidth = activeDocument.selection.bounds[2].value - activeDocument.selection.bounds[0].value;
    var pixelsHeight = activeDocument.selection.bounds[3].value - activeDocument.selection.bounds[1].value;
    var pixelsArea = pixelsWidth * pixelsHeight;
    refSize = 1 - (pixelsArea / ((activeDocument.activeLayer.bounds[2].value - activeDocument.activeLayer.bounds[0].value) * (activeDocument.activeLayer.bounds[3].value - activeDocument.activeLayer.bounds[1].value)));

    // var btnWidth = 20;
    // makePointSelection([[(lyrWidthInPt / 2) - (btnWidth / 2) + activeDocument.activeLayer.bounds[0].as('pt'), 0],[(lyrWidthInPt / 2) + (btnWidth / 2) + activeDocument.activeLayer.bounds[0].as('pt'), 0],[(lyrWidthInPt / 2) + (btnWidth / 2) + activeDocument.activeLayer.bounds[0].as('pt'), activeDocument.height.as('pt')], [(lyrWidthInPt / 2) - (btnWidth / 2) + activeDocument.activeLayer.bounds[0].as('pt'), activeDocument.height.as('pt')]], 0, SelectionType.DIMINISH);
    activeDocument.selection.copy();
    grp_Ref.visible = false;
    var lyr_MatchGrp = activeDocument.layerSets.add();
    activeDocument.activeLayer.name = "Auto match";
    var lyr_AutoRef = activeDocument.paste();
    activeDocument.activeLayer.name = "Auto - Ref";
    alignCenter();
    lyr_AutoRef.visible = false;
    lyr_FillAuto = fillSolidColour(0, 0, 0);
    moveLayerUpOrDown("Down");

    // ----- Create cutout for garment -----
    activeDocument.activeLayer = grp_Garment.parent;
    var garmentMaskFeather = grp_Garment.filterMaskFeather;
    grp_Garment.filterMaskFeather = 0.0;
    // Selection from garment mask
    selectionFromMask();
    activeDocument.selection.contract(new UnitValue (30, "px"));
    activeDocument.activeLayer = lyr_FillAuto;
    lyr_FillAuto.visible = false;
    activeDocument.selection.copy(true);
    lyr_FillAuto.visible = true;
    var lyr_AutoGarm = activeDocument.paste();
    activeDocument.activeLayer.name = "Auto - Garment";
    alignCenter();

    ///////////////////////////////////////
    ///////// SAMPLE - BRIGHTNESS /////////
    ///////////////////////////////////////

    lyr_SamplerCheck = activeDocument.artLayers.add();
    lyr_SamplerCheck.name = "Sampler Check";

    // Get brightness sample for Ref
    lyr_AutoGarm.visible = false;
    lyr_AutoRef.visible = true;
    // Set brightness cap
    activeDocument.activeLayer = lyr_AutoRef;
    var preBrightnessCap = app.activeDocument.activeHistoryState;
    if (vibranceLyr) {
        createVibrance();
        adjustVibrance(-100);
        activeDocument.activeLayer.merge();
    } else {
        activeDocument.activeLayer.desaturate();
    }
    brightnessBlendCap = (averageBlendIf([0, 0], [255, 255], [0, 0], [255, 255])[0]) - 20;
    // return alert(brightnessBlendCap);
    // if (brightnessBlendCap < 0 || brightnessBlendCap > 100) brightnessBlendCap = 0;
    if (brightnessBlendCap < 0 || brightnessBlendCap < 25) brightnessBlendCap = 0;
    // if (brightnessBlendCap > 120) brightnessBlendCap = 120;
    // brightnessBlendCap = 0;
    app.activeDocument.activeHistoryState = preBrightnessCap;

    for (i = 0; i < brightnessSteps; i++) {
        activeDocument.activeLayer = lyr_AutoRef;
        var preBlendIf = app.activeDocument.activeHistoryState;
        if (vibranceLyr) {
            createVibrance();
            adjustVibrance(-100);
            activeDocument.activeLayer.merge();
        } else {
            activeDocument.activeLayer.desaturate();
        }
        samplesRefBrightness.push(averageBlendIf([brightnessBlendCap, brightnessBlendCap], [255, 255], [0, 0], [255, 255]));
        app.activeDocument.activeHistoryState = preBlendIf;
    }

    // Get brightness sample for Garm
    lyr_AutoRef.visible = false;
    lyr_AutoGarm.visible = true;
    for (i = 0; i < brightnessSteps; i++) {
        activeDocument.activeLayer = lyr_AutoGarm;
        var preBlendIf = app.activeDocument.activeHistoryState;
        if (vibranceLyr) {
            createVibrance();
            adjustVibrance(-100);
            activeDocument.activeLayer.merge();
        } else {
            activeDocument.activeLayer.desaturate();
        }
        samplesGarmBrightness.push(averageBlendIf([brightnessBlendCap, brightnessBlendCap], [255, 255], [0, 0], [255, 255]));
        if (samplesGarmBrightness[i][0] == 0 && samplesGarmBrightness[i][1] == 0 && samplesGarmBrightness[i][2] == 0) samplesGarmBrightness[i] = samplesRefBrightness[i];
        app.activeDocument.activeHistoryState = preBlendIf;
    }

    /////////////////////////////////////////
    ///////// SWATCHES - BRIGHTNESS /////////
    /////////////////////////////////////////

    var currentRulerUnits = app.preferences.rulerUnits;
    var currentTypeUnits = app.preferences.typeUnits;
    var currentDisplayDialogs = app.displayDialogs;

    app.preferences.rulerUnits = Units.POINTS;
    app.preferences.typeUnits = TypeUnits.POINTS;
    app.displayDialogs = DialogModes.NO;
    
    // Brightness swatches for garment
    lyr_GrpSamplesGarm = activeDocument.layerSets.add();
    lyr_GrpSamplesGarm.name = "Auto - Samples Garment";
    var sampleSize = 10;
    var sampleStartX = 0;
    var sampleStartY = 0;
    for (i = 0; i < brightnessSteps; i++) {
        createSamples([[sampleStartX, sampleStartY], [sampleStartX + sampleSize, sampleStartY], [sampleStartX + sampleSize, sampleStartY + sampleSize], [sampleStartX, sampleStartY + sampleSize]], samplesGarmBrightness[i]);
        sampleStartY = sampleStartY + sampleSize;
    }

    // Brightness swatches for ref
    activeDocument.activeLayer = grp_Ref;
    var lyr_GrpSamplesRef = activeDocument.layerSets.add();
    lyr_GrpSamplesRef.name = "Auto - Samples Reference";
    var sampleStartX = 10;
    var sampleStartY = 0;
    for (i = 0; i < brightnessSteps; i++) {
        createSamples([[sampleStartX, sampleStartY], [sampleStartX + sampleSize, sampleStartY], [sampleStartX + sampleSize, sampleStartY + sampleSize], [sampleStartX, sampleStartY + sampleSize]], samplesRefBrightness[i]);
        sampleStartY = sampleStartY + sampleSize;
    }

    lyr_SamplerCheck.move(activeDocument.layers[0], ElementPlacement.PLACEBEFORE);

    ///////////////////////////////////////
    ///////// ADJUSTMENT - CURVES /////////
    ///////////////////////////////////////

    // Create curves adjustment layer
    activeDocument.activeLayer = lyr_GrpSamplesGarm;
    createCurves();
    var lyr_Curves = activeDocument.activeLayer;
    lyr_Curves.name = "Garment brightness";
    deleteMask();
    lyr_GrpSamplesGarm.artLayers.add();
    var lyr_UnderCurves = activeDocument.activeLayer;
    moveLayerUpOrDown("Down");

    app.refresh();

    // Adjust curves
    activeDocument.activeLayer = lyr_GrpSamplesGarm;
    for (i = 0; i < brightnessSteps; i++) {
        adjustCurvesToMatch(lyr_Curves, samplesArrayBrightness[i], samplesArrayBrightness[samplesArrayBrightness.length / 2 + i]);
    }

    activeDocument.colorSamplers.removeAll();
    
    app.preferences.rulerUnits = currentRulerUnits;
    app.preferences.typeUnits = currentTypeUnits;
    app.displayDialogs = currentDisplayDialogs;
    
    ////////////////////////////////
    ///////// SAMPLE - RGB /////////
    ////////////////////////////////

    // Get RGB samples for Ref
    lyr_AutoGarm.visible = false;
    lyr_AutoRef.visible = true;
    lyr_Curves.visible = false;
    for (i = 0; i < gradientSteps; i++) {
        activeDocument.activeLayer = lyr_AutoRef;
        var preGetWeight = app.activeDocument.activeHistoryState;
        spanWeightRef.push(getSpanWeight([blendIfSpan * i, blendIfSpan * i], [blendIfSpan * (i + 1), blendIfSpan * (i + 1)], [0, 0], [255, 255]));
        app.activeDocument.activeHistoryState = preGetWeight;
        activeDocument.activeLayer = lyr_AutoRef;
        var preBlendIf = app.activeDocument.activeHistoryState;
        samplesRef.push(averageBlendIf([blendIfSpan * i, blendIfSpan * i], [blendIfSpan * (i + 1), blendIfSpan * (i + 1)], [0, 0], [255, 255]));
        app.activeDocument.activeHistoryState = preBlendIf;
    }

    // Get RGB samples for Garm
    lyr_AutoRef.visible = false;
    lyr_AutoGarm.visible = true;

    // Create curved garment
    var lyr_tempCurves = lyr_Curves.duplicate(lyr_AutoGarm, ElementPlacement.PLACEBEFORE);
    lyr_tempCurves.visible = true;
    var grp_Temp = activeDocument.layerSets.add();
    grp_Temp.move(lyr_tempCurves, ElementPlacement.PLACEBEFORE);
    lyr_AutoGarm.duplicate(grp_Temp, ElementPlacement.INSIDE);
    lyr_tempCurves.move(grp_Temp, ElementPlacement.INSIDE);
    activeDocument.activeLayer = grp_Temp;
    grp_Temp.merge();
    var lyr_AutoGarmTemp = activeDocument.activeLayer;
    lyr_AutoGarm.visible = false;
    
    for (i = 0; i < gradientSteps; i++) {
        activeDocument.activeLayer = lyr_AutoGarmTemp;
        var preGetWeight = app.activeDocument.activeHistoryState;
        spanWeightGarm.push(getSpanWeight([blendIfSpan * i, blendIfSpan * i], [blendIfSpan * (i + 1), blendIfSpan * (i + 1)], [0, 0], [255, 255]));
        app.activeDocument.activeHistoryState = preGetWeight;
        var preBlendIf = app.activeDocument.activeHistoryState;
        samplesGarm.push(averageBlendIf([blendIfSpan * i, blendIfSpan * i], [blendIfSpan * (i + 1), blendIfSpan * (i + 1)], [0, 0], [255, 255]));
        app.activeDocument.activeHistoryState = preBlendIf;
    }

    lyr_MatchGrp.remove();
    grp_Garment.filterMaskFeather = garmentMaskFeather;

    //////////////////////////////////
    ///////// SWATCHES - RGB /////////
    //////////////////////////////////

    var currentRulerUnits = app.preferences.rulerUnits;
    var currentTypeUnits = app.preferences.typeUnits;
    var currentDisplayDialogs = app.displayDialogs;

    app.preferences.rulerUnits = Units.POINTS;
    app.preferences.typeUnits = TypeUnits.POINTS;
    app.displayDialogs = DialogModes.NO;

    // RGB swatches for garment
    activeDocument.activeLayer = lyr_UnderCurves;
    var sampleStartX = 0;
    for (i = 0; i < gradientSteps; i++) {
        createSamples([[sampleStartX, sampleStartY], [sampleStartX + sampleSize, sampleStartY], [sampleStartX + sampleSize, sampleStartY + sampleSize], [sampleStartX, sampleStartY + sampleSize]], samplesGarm[i], "rgb");
        sampleStartY = sampleStartY + sampleSize;
    }

    // RGB swatches for ref
    activeDocument.activeLayer = lyr_GrpSamplesRef;
    var sampleStartX = 10;
    var sampleStartY = sampleSize * brightnessSteps;
    for (i = 0; i < gradientSteps; i++) {
        createSamples([[sampleStartX, sampleStartY], [sampleStartX + sampleSize, sampleStartY], [sampleStartX + sampleSize, sampleStartY + sampleSize], [sampleStartX, sampleStartY + sampleSize]], samplesRef[i], "rgb");
        sampleStartY = sampleStartY + sampleSize;
    }

    app.preferences.rulerUnits = currentRulerUnits;
    app.preferences.typeUnits = currentTypeUnits;
    app.displayDialogs = currentDisplayDialogs;

    //////////////////////////////////////////////
    ///////// ADJUSTMENT - CHANNEL MIXER /////////
    //////////////////////////////////////////////

    // Create garment adjustment layers
    activeDocument.activeLayer = lyr_Curves;
    var chMxArray = [];
    for (i = 0; i < gradientSteps; i++) {
        createChannelMixer();
        chMxArray.push(activeDocument.activeLayer);
        activeDocument.activeLayer.name = "Channel Mixer (" + (blendIfSpan * i) + "-" + (blendIfSpan * (i + 1)) + ")";
        blendIf([0, 0], [255, 255], [blendIfSpan * i, blendIfSpan * i], [blendIfSpan * (i + 1), blendIfSpan * (i + 1)]);
    }

    lyr_Curves.move(grp_Garment, ElementPlacement.INSIDE);
    app.refresh();
    
    // Adjust Channel Mixers
    activeDocument.activeLayer = lyr_GrpSamplesGarm;
    for (i = 0; i < gradientSteps; i++) {
        adjustRgbToMatch(chMxArray[i], samplesArrayRGB[i], samplesArrayRGB[gradientSteps + i]);
    }

    // Move layers to Garment group
    for (i = 0; i < gradientSteps; i++) {
        chMxArray[i].move(grp_Garment, ElementPlacement.INSIDE);
    }

    // Clean-up
    lyr_SamplerCheck.remove();
    if (!troubleshoot) {
        activeDocument.colorSamplers.removeAll();
        lyr_GrpSamplesGarm.remove();
        lyr_GrpSamplesRef.remove();
        grp_Ref.visible = showEndMatchRef;
    }

    /////////////////////////////////////
    ///////// ADDITIONAL LAYERS /////////
    /////////////////////////////////////

    // Set weight and add vibrance layers
    var blendIfSpanGrad = blendIfSpan + (blendIfSpan / gradientSteps);
    for (i = 0; i < gradientSteps; i++) {

        var blackLow = Math.round(blendIfSpanGrad * (i - 1) + (blendIfSpanGrad / 2));
        if (blackLow < 0) blackLow = 0;
        var blackHigh = Math.round(blendIfSpanGrad * i + (blendIfSpanGrad / 2));

        var whiteLow = Math.round(blendIfSpanGrad * i + (blendIfSpanGrad / 2));
        var whiteHigh = Math.round(blendIfSpanGrad * (i + 1) + (blendIfSpanGrad / 2));
        if (whiteHigh > 255) whiteHigh = 255;
        
        activeDocument.activeLayer = chMxArray[i];
        deleteMask();
        blendIf([0, 0], [255, 255], [blackLow, blackHigh], [whiteLow, whiteHigh]);

        function getBaseLog(x, y) {
            return Math.log(y) / Math.log(x);
        }
        // alert("Span #" + i + ":\nGarm " + spanWeightGarm[i] + "\nRef " + spanWeightRef[i]);
        // TODO: The span weight in ref layer need to influence the opacity too (atm spanWeightRef[i] gets its values too low)
        // This is a bit fucked.. needs to be able to go below 40%. A lot of shadows become grey due to the low cap on 40
        var weightGarm = ((getBaseLog(100, spanWeightGarm[i] * (1 + garmentSize)) * 100) / 3) * 2;
        if (!isFinite(weightGarm)) weightGarm = 10;
        // alert(weightGarm)
        // if (!weightGarm) weightGarm = 0;
        // var weightGarm = (40 + spanWeightGarm[i] * (1 + garmentSize));
        // var weightRef = (40 + spanWeightRef[i] * (1 + refSize));
        // alert(i + " garm: " + spanWeightGarm[i])
        // alert(i + " ref: " + spanWeightRef[i])
        var weightedOpacity = weightGarm;
        if (weightedOpacity > 100.00) weightedOpacity = 100.00;
        if (weightedOpacity < 0.00) weightedOpacity = 0.00;
        chMxArray[i].opacity = weightedOpacity;
        if (weightedOpacity == 0.00) {
            chMxArray[i].opacity = 0.0;
            functionLayerColour("grey");
            chMxArray[i].visible = false;
        }

        if (addVibrance) {
            createVibrance();
            adjustVibrance(-100);
            blendIf([0, 0], [255, 255], [blackLow, blackHigh], [whiteLow, whiteHigh]);
            activeDocument.activeLayer.name = "Vibrance (" + (blendIfSpan * i) + "-" + (blendIfSpan * (i + 1)) + ")";

            activeDocument.activeLayer.opacity = 0.0;
            deleteMask();
            if (weightedOpacity == 40.00) {
                functionLayerColour("grey");
                activeDocument.activeLayer.visible = false;
            }
        }

    }

    if (addAdditional) {
        // Add "Raise Black Point" adjustment layer
        activeDocument.activeLayer = lyr_Curves;
        createCurves();
        activeDocument.activeLayer.name = "Raise Black Point";
        deleteMask();
        adjustCurves([[0, 50], [255, 255]]);
        activeDocument.activeLayer.opacity = 0.0;

        // Add "Lower White Point" adjustment layer
        activeDocument.activeLayer = lyr_Curves;
        createCurves();
        activeDocument.activeLayer.name = "Lower White Point";
        deleteMask();
        adjustCurves([[0, 0], [255, 205]]);
        activeDocument.activeLayer.opacity = 0.0;

        // Add "Less Contrast" adjustment layer
        activeDocument.activeLayer = lyr_Curves;
        createCurves();
        activeDocument.activeLayer.name = "Less Contrast";
        deleteMask();
        adjustCurves([[0, 50], [255, 205]]);
        activeDocument.activeLayer.opacity = 0.0;
    }

    if (saveJpgCheckFile) {
        grp_Ref.visible = true;
        var jpgDir = new Folder(activeDocument.path + "/_MatchCheck");
        saveAsJPG(jpgDir, activeDocument.name.substring(0, activeDocument.name.lastIndexOf(".")));
        grp_Ref.visible = showEndMatchRef;
    }

}

// FUNCTIONS

function adjustRgbToMatch(lyr, sampleA, sampleB) {
    
    if (sampleA.color.rgb.red == 0 && sampleA.color.rgb.green == 0 && sampleA.color.rgb.blue == 0) return;
    if (sampleB.color.rgb.red == 0 && sampleB.color.rgb.green == 0 && sampleB.color.rgb.blue == 0) return;
    var timeoutStart = 69;
    var startValueStart = 100.00;
    var steps = 0.5;

    var timeout = timeoutStart;
    var startValue = startValueStart;

    if (sampleA.color.rgb.red < sampleB.color.rgb.red) {
        while (sampleA.color.rgb.red < sampleB.color.rgb.red) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("red", startValue);
            activeDocument.activeLayer = lyr_SamplerCheck;
            startValue = startValue + steps;
            timeout--;
            if (timeout <= 0) break;
        }
    } else {
        while (sampleA.color.rgb.red > sampleB.color.rgb.red) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("red", startValue);
            activeDocument.activeLayer = lyr_SamplerCheck;
            startValue = startValue - steps;
            timeout--;
            if (timeout <= 0) break;
        }
    }
    var timeout = timeoutStart;
    var startValue = startValueStart;
    if (sampleA.color.rgb.green < sampleB.color.rgb.green) {
        while (sampleA.color.rgb.green < sampleB.color.rgb.green) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("green", startValue);
            activeDocument.activeLayer = lyr_SamplerCheck;
            startValue = startValue + steps;
            timeout--;
            if (timeout <= 0) break;
        }
    } else {
        while (sampleA.color.rgb.green > sampleB.color.rgb.green) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("green", startValue);
            activeDocument.activeLayer = lyr_SamplerCheck;
            startValue = startValue - steps;
            timeout--;
            if (timeout <= 0) break;
        }
    }
    var timeout = timeoutStart;
    var startValue = startValueStart;
    if (sampleA.color.rgb.blue < sampleB.color.rgb.blue) {
        while (sampleA.color.rgb.blue < sampleB.color.rgb.blue) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("blue", startValue);
            activeDocument.activeLayer = lyr_SamplerCheck;
            startValue = startValue + steps;
            timeout--;
            if (timeout <= 0) break;
        }
    } else {
        while (sampleA.color.rgb.blue > sampleB.color.rgb.blue) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("blue", startValue);
            activeDocument.activeLayer = lyr_SamplerCheck;
            startValue = startValue - steps;
            timeout--;
            if (timeout <= 0) break;
        }
    }
}

function adjustLevelsToMatch(lyr, sampleA, sampleB) {
    var timeout = 61;
    var startValue = 1.000000;
    if (sampleA.color.rgb.red < sampleB.color.rgb.red) {
        while (sampleA.color.rgb.red < sampleB.color.rgb.red) {
            activeDocument.activeLayer = lyr;
            adjustLevels("gamma", startValue);
            activeDocument.activeLayer = lyr_SamplerCheck;
            startValue = startValue + 0.01;
            timeout--;
            if (timeout <= 0) break;
        }
    } else {
        while (sampleA.color.rgb.red > sampleB.color.rgb.red) {
            activeDocument.activeLayer = lyr;
            adjustLevels("gamma", startValue);
            activeDocument.activeLayer = lyr_SamplerCheck;
            startValue = startValue - 0.01;
            timeout--;
            if (timeout <= 0) break;
        }
    }
}

function adjustCurvesToMatch(lyr, sampleA, sampleB) {
    var timeout = 41;
    var input = 128.000000;
    var output = 128.000000;
    if (sampleA.color.rgb.red < sampleB.color.rgb.red) {
        while (sampleA.color.rgb.red < sampleB.color.rgb.red) {
            activeDocument.activeLayer = lyr;
            adjustCurves([[0, 0], [input, output], [255, 253]]);
            activeDocument.activeLayer = lyr_SamplerCheck;
            input = input - 1;
            output = output + 1;
            timeout--;
            if (timeout <= 0) break;
        }
    } else {
        while (sampleA.color.rgb.red > sampleB.color.rgb.red) {
            activeDocument.activeLayer = lyr;
            adjustCurves([[0, 0], [input, output], [255, 253]]);
            activeDocument.activeLayer = lyr_SamplerCheck;
            input = input + 1;
            output = output - 1;
            timeout--;
            if (timeout <= 0) break;
        }
    }
}

function createSamples(coordinates, rgb, mode) {
    makePointSelection(coordinates, 0, SelectionType.REPLACE);
    fillSolidColour(rgb[0], rgb[1], rgb[2]);
    selectionFromMask();
    var daSample = activeDocument.colorSamplers.add([activeDocument.selection.bounds[0].as('pt') + 1, activeDocument.selection.bounds[1].as('pt') + 1]);
    activeDocument.selection.deselect();
    
    if (mode == "rgb") {
        samplesArrayRGB.push(daSample);
    } else {
        samplesArrayBrightness.push(daSample);
    }
}

function getSpanWeight(thisBlack, thisWhite, underBlack, underWhite) {

    blendIf(thisBlack, thisWhite, underBlack, underWhite);
    colorRange("shadows", 0, 0);
    activeDocument.selection.contract(new UnitValue (1, "px"));
    try {
        if (activeDocument.selection.bounds) activeDocument.selection.clear();
    } catch(e) {
        return 0.0;
    }
    activeDocument.selection.deselect();
    blendIf([0, 0], [255, 255], [0, 0], [255, 255]);
    
    // Fill white
    var idfill = stringIDToTypeID( "fill" );
        var desc1718 = new ActionDescriptor();
        var idusing = stringIDToTypeID( "using" );
        var idfillContents = stringIDToTypeID( "fillContents" );
        var idcolor = stringIDToTypeID( "color" );
        desc1718.putEnumerated( idusing, idfillContents, idcolor );
        var idcolor = stringIDToTypeID( "color" );
            var desc1719 = new ActionDescriptor();
            var idhue = stringIDToTypeID( "hue" );
            var idangleUnit = stringIDToTypeID( "angleUnit" );
            desc1719.putUnitDouble( idhue, idangleUnit, 0.000000 );
            var idsaturation = stringIDToTypeID( "saturation" );
            desc1719.putDouble( idsaturation, 0.000000 );
            var idbrightness = stringIDToTypeID( "brightness" );
            desc1719.putDouble( idbrightness, 100.000000 );
        var idHSBColorClass = stringIDToTypeID( "HSBColorClass" );
        desc1718.putObject( idcolor, idHSBColorClass, desc1719 );
        var idopacity = stringIDToTypeID( "opacity" );
        var idpercentUnit = stringIDToTypeID( "percentUnit" );
        desc1718.putUnitDouble( idopacity, idpercentUnit, 100.000000 );
        var idmode = stringIDToTypeID( "mode" );
        var idblendMode = stringIDToTypeID( "blendMode" );
        var idnormal = stringIDToTypeID( "normal" );
        desc1718.putEnumerated( idmode, idblendMode, idnormal );
        var idpreserveTransparency = stringIDToTypeID( "preserveTransparency" );
        desc1718.putBoolean( idpreserveTransparency, true );
    executeAction( idfill, desc1718, DialogModes.NO );

    var tempWeight = activeDocument.activeLayer;
    var grp_TempWeight = activeDocument.layerSets.add();
    lyr_FillAuto.move(grp_TempWeight, ElementPlacement.INSIDE);
    tempWeight.move(grp_TempWeight, ElementPlacement.INSIDE);
    grp_TempWeight.merge();

    // Average
    try {
        layerSelection();
        var idAvrg = charIDToTypeID( "Avrg" );
        executeAction( idAvrg, undefined, DialogModes.NO );
        activeDocument.selection.deselect();
    } catch(e) {}

    getSample();
    return (cleanRGB[0] / 255) * 100; // Return value from 0-100

}

function averageBlendIf(thisBlack, thisWhite, underBlack, underWhite) {

    blendIf(thisBlack, thisWhite, underBlack, underWhite);
    colorRange("shadows", 0, 0);
    activeDocument.selection.expand(new UnitValue (1, "px"));

    try {
        if (activeDocument.selection.bounds) activeDocument.selection.clear();
    } catch(e) {
        // if (troubleshoot) alert("Could not delete any pixels");
        return [0, 0, 0];
    }
    activeDocument.selection.deselect();
    blendIf([0, 0], [255, 255], [0, 0], [255, 255]);

    try {
        alignCenter();
    } catch(e) {
        // if (troubleshoot) alert("Could not center layer (first)");
        return [0, 0, 0];
    }
    
    // Average
    layerSelection();
    var idAvrg = charIDToTypeID( "Avrg" );
    executeAction( idAvrg, undefined, DialogModes.NO );
    activeDocument.selection.deselect();
    
    layerSelection();
    activeDocument.selection.contract(new UnitValue (1, "px"));
    activeDocument.selection.invert();
    try {
        if (activeDocument.selection.bounds) activeDocument.selection.clear();
    } catch(e) {}
    activeDocument.selection.deselect();
    
    // Minimum
    var idminimum = stringIDToTypeID( "minimum" );
        var desc252 = new ActionDescriptor();
        var idradius = stringIDToTypeID( "radius" );
        var idpixelsUnit = stringIDToTypeID( "pixelsUnit" );
        desc252.putUnitDouble( idradius, idpixelsUnit, minimumFilter );
        var idpreserveShape = stringIDToTypeID( "preserveShape" );
        var idpreserveShape = stringIDToTypeID( "preserveShape" );
        var idsquareness = stringIDToTypeID( "squareness" );
        desc252.putEnumerated( idpreserveShape, idpreserveShape, idsquareness );
    executeAction( idminimum, desc252, DialogModes.NO );
    
    // Average
    layerSelection();
    var idAvrg = charIDToTypeID( "Avrg" );
    executeAction( idAvrg, undefined, DialogModes.NO );
    activeDocument.selection.deselect();

    try {
        alignCenter();
    } catch(e) {
        // if (troubleshoot) alert("Could not center layer (seccond)");
        return [0, 0, 0];
    }
    
    var centerX = activeDocument.width.as('pt') / 2;
    var centerY = activeDocument.height.as('pt') / 2;
    var left = 0;
    var top = Math.round(centerY - (caCrossSize / 2));
    var right = Math.round(activeDocument.width.as('pt'));
    var bottom = Math.round(centerY + (caCrossSize / 2));
    makePointSelection([[left, top],[right, top],[right, bottom], [left, bottom]], 0, SelectionType.REPLACE);

    var centerX = activeDocument.width.as('pt') / 2;
    var centerY = activeDocument.height.as('pt') / 2;
    var left = Math.round(centerX - (caCrossSize / 2));
    var top = 0;
    var right = Math.round(centerX + (caCrossSize / 2));
    var bottom = Math.round(activeDocument.height.as('pt'));
    makePointSelection([[left, top],[right, top],[right, bottom], [left, bottom]], 0, SelectionType.EXTEND);

    layerSelectionDiminish();

    try {
        if (activeDocument.selection.bounds) {
            contentAwareFill(false);
            layerSelection();
            activeDocument.selection.contract(new UnitValue (2, "px"));
            activeDocument.selection.invert();
            removeSelectionFeather();
            activeDocument.selection.clear();
            activeDocument.selection.deselect();
        }
    } catch(e) {
        // The sample will be big enough
    }
    
    // Sample
    activeDocument.suspendHistory("Get sample", "getSample()");

    return cleanRGB;

}

function getSample() {
    // Sample
    var sampleChecks = 0;
    var sampleSteps = 20;
    var direction = "right";
    cleanRGB = [0, 0, 0];
    activeDocument.activeLayer = lyr_SamplerCheck;
        
    while (cleanRGB[0] == 0 && cleanRGB[1] == 0 && cleanRGB[2] == 0) {

        switch (direction) {
            case "up": var cS = activeDocument.colorSamplers.add([activeDocument.width.value / 2, activeDocument.height.value / 2 + sampleChecks]); direction = "down"; break;
            case "down": var cS = activeDocument.colorSamplers.add([activeDocument.width.value / 2, activeDocument.height.value / 2 - sampleChecks]); direction = "left"; break;
            case "left": var cS = activeDocument.colorSamplers.add([activeDocument.width.value / 2 - sampleChecks, activeDocument.height.value / 2]); direction = "right"; break;
            case "right": var cS = activeDocument.colorSamplers.add([activeDocument.width.value / 2 + sampleChecks, activeDocument.height.value / 2]); direction = "up"; sampleChecks = sampleChecks + sampleSteps; break;
            default: var cS = activeDocument.colorSamplers.add([activeDocument.width.value / 2, activeDocument.height.value / 2 + sampleChecks]);
        }

        var cSr = cS.color.rgb.red;
        var cSg = cS.color.rgb.green;
        var cSb = cS.color.rgb.blue;
        
        var newColor = new SolidColor
        newColor.rgb.red = cSr;
        newColor.rgb.green = cSg;
        newColor.rgb.blue = cSb;

        cleanRGB = [cSr, cSg, cSb];
        
        activeDocument.colorSamplers.removeAll();

        if (sampleChecks >= 20) break;

    }
}

function functionLayerColour(colour) {
	switch (colour.toLocaleLowerCase()) {
		case 'red': colour = 'Rd  '; break;
		case 'orange' : colour = 'Orng'; break;
		case 'yellow' : colour = 'Ylw '; break;
		case 'green' : colour = 'Grn '; break;
		case 'blue' : colour = 'Bl  '; break;
		case 'violet' : colour = 'Vlt '; break;
		case 'gray' : colour = 'Gry '; break;
		case 'grey' : colour = 'Gry '; break;
		case 'none' : colour = 'None'; break;
		default : colour = 'None'; break;
	}
	var desc = new ActionDescriptor();
		var ref = new ActionReference();
		ref.putEnumerated( charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt') );
	desc.putReference( charIDToTypeID('null'), ref );
		var desc2 = new ActionDescriptor();
		desc2.putEnumerated( charIDToTypeID('Clr '), charIDToTypeID('Clr '), charIDToTypeID(colour) );
	desc.putObject( charIDToTypeID('T   '), charIDToTypeID('Lyr '), desc2 );
	executeAction( charIDToTypeID('setd'), desc, DialogModes.NO );
}

function selectionFromMask() {
    var idset = stringIDToTypeID( "set" );
        var desc307 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref268 = new ActionReference();
            var idchannel = stringIDToTypeID( "channel" );
            var idselection = stringIDToTypeID( "selection" );
            ref268.putProperty( idchannel, idselection );
        desc307.putReference( idnull, ref268 );
        var idto = stringIDToTypeID( "to" );
            var ref269 = new ActionReference();
            var idchannel = stringIDToTypeID( "channel" );
            var idchannel = stringIDToTypeID( "channel" );
            var idmask = stringIDToTypeID( "mask" );
            ref269.putEnumerated( idchannel, idchannel, idmask );
        desc307.putReference( idto, ref269 );
    executeAction( idset, desc307, DialogModes.NO );
}

function maskFeather(lyr, amount) {
    var currentLyr = activeDocument.activeLayer;
    activeDocument.activeLayer = lyr;
  
    var idset = stringIDToTypeID( "set" );
        var desc1032 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref525 = new ActionReference();
            var idlayer = stringIDToTypeID( "layer" );
            var idordinal = stringIDToTypeID( "ordinal" );
            var idtargetEnum = stringIDToTypeID( "targetEnum" );
            ref525.putEnumerated( idlayer, idordinal, idtargetEnum );
        desc1032.putReference( idnull, ref525 );
        var idto = stringIDToTypeID( "to" );
            var desc1033 = new ActionDescriptor();
            var iduserMaskFeather = stringIDToTypeID( "userMaskFeather" );
            var idpixelsUnit = stringIDToTypeID( "pixelsUnit" );
            desc1033.putUnitDouble( iduserMaskFeather, idpixelsUnit, amount );
        var idlayer = stringIDToTypeID( "layer" );
        desc1032.putObject( idto, idlayer, desc1033 );
    executeAction( idset, desc1032, DialogModes.NO );
    
    activeDocument.activeLayer = currentLyr;
}

function removeSelectionFeather() {
    var idsmartBrushWorkspace = stringIDToTypeID( "smartBrushWorkspace" );
        var desc214 = new ActionDescriptor();
        var idsmartBrushRadius = stringIDToTypeID( "smartBrushRadius" );
        desc214.putInteger( idsmartBrushRadius, 0 );
        var idsmartBrushSmooth = stringIDToTypeID( "smartBrushSmooth" );
        desc214.putInteger( idsmartBrushSmooth, 0 );
        var idsmartBrushFeather = stringIDToTypeID( "smartBrushFeather" );
        var idpixelsUnit = stringIDToTypeID( "pixelsUnit" );
        desc214.putUnitDouble( idsmartBrushFeather, idpixelsUnit, 0.000000 );
        var idsmartBrushContrast = stringIDToTypeID( "smartBrushContrast" );
        var idpercentUnit = stringIDToTypeID( "percentUnit" );
        desc214.putUnitDouble( idsmartBrushContrast, idpercentUnit, 100.000000 );
        var idsmartBrushShiftEdge = stringIDToTypeID( "smartBrushShiftEdge" );
        var idpercentUnit = stringIDToTypeID( "percentUnit" );
        desc214.putUnitDouble( idsmartBrushShiftEdge, idpercentUnit, 0.000000 );
        var idsampleAllLayers = stringIDToTypeID( "sampleAllLayers" );
        desc214.putBoolean( idsampleAllLayers, true );
        var idsmartBrushUseSmartRadius = stringIDToTypeID( "smartBrushUseSmartRadius" );
        desc214.putBoolean( idsmartBrushUseSmartRadius, false );
        var idsmartBrushDecontaminate = stringIDToTypeID( "smartBrushDecontaminate" );
        desc214.putBoolean( idsmartBrushDecontaminate, false );
        var idsmartBrushDeconAmount = stringIDToTypeID( "smartBrushDeconAmount" );
        var idpercentUnit = stringIDToTypeID( "percentUnit" );
        desc214.putUnitDouble( idsmartBrushDeconAmount, idpercentUnit, 100.000000 );
        var idrefineEdgeOutput = stringIDToTypeID( "refineEdgeOutput" );
        var idrefineEdgeOutput = stringIDToTypeID( "refineEdgeOutput" );
        var idselectionOutputToSelection = stringIDToTypeID( "selectionOutputToSelection" );
        desc214.putEnumerated( idrefineEdgeOutput, idrefineEdgeOutput, idselectionOutputToSelection );
    executeAction( idsmartBrushWorkspace, desc214, DialogModes.NO );
}

function selectSubject(sampleAllLayers) {
    var idautoCutout = stringIDToTypeID( "autoCutout" );
        var desc16 = new ActionDescriptor();
        var idsampleAllLayers = stringIDToTypeID( "sampleAllLayers" );
        desc16.putBoolean( idsampleAllLayers, sampleAllLayers );
    executeAction( idautoCutout, desc16, DialogModes.NO );
}

function contentAwareFill(colorAdaption) {
    var idfill = stringIDToTypeID( "fill" );
        var desc180 = new ActionDescriptor();
        var idusing = stringIDToTypeID( "using" );
        var idfillContents = stringIDToTypeID( "fillContents" );
        var idcontentAware = stringIDToTypeID( "contentAware" );
        desc180.putEnumerated( idusing, idfillContents, idcontentAware );
        var idcontentAwareColorAdaptationFill = stringIDToTypeID( "contentAwareColorAdaptationFill" );
        desc180.putBoolean( idcontentAwareColorAdaptationFill, colorAdaption );
        var idcontentAwareRotateFill = stringIDToTypeID( "contentAwareRotateFill" );
        desc180.putBoolean( idcontentAwareRotateFill, false );
        var idcontentAwareScaleFill = stringIDToTypeID( "contentAwareScaleFill" );
        desc180.putBoolean( idcontentAwareScaleFill, false );
        var idcontentAwareMirrorFill = stringIDToTypeID( "contentAwareMirrorFill" );
        desc180.putBoolean( idcontentAwareMirrorFill, false );
        var idopacity = stringIDToTypeID( "opacity" );
        var idpercentUnit = stringIDToTypeID( "percentUnit" );
        desc180.putUnitDouble( idopacity, idpercentUnit, 100.000000 );
        var idmode = stringIDToTypeID( "mode" );
        var idblendMode = stringIDToTypeID( "blendMode" );
        var idnormal = stringIDToTypeID( "normal" );
        desc180.putEnumerated( idmode, idblendMode, idnormal );
    executeAction( idfill, desc180, DialogModes.NO );
}

function layerSelection() {
    var idset = stringIDToTypeID( "set" );
        var desc1345 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref1144 = new ActionReference();
            var idchannel = stringIDToTypeID( "channel" );
            var idselection = stringIDToTypeID( "selection" );
            ref1144.putProperty( idchannel, idselection );
        desc1345.putReference( idnull, ref1144 );
        var idto = stringIDToTypeID( "to" );
            var ref1145 = new ActionReference();
            var idchannel = stringIDToTypeID( "channel" );
            var idchannel = stringIDToTypeID( "channel" );
            var idtransparencyEnum = stringIDToTypeID( "transparencyEnum" );
            ref1145.putEnumerated( idchannel, idchannel, idtransparencyEnum );
        desc1345.putReference( idto, ref1145 );
    executeAction( idset, desc1345, DialogModes.NO );
}

function layerSelectionDiminish() {
    var idsubtract = stringIDToTypeID( "subtract" );
        var desc84 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref76 = new ActionReference();
            var idchannel = stringIDToTypeID( "channel" );
            var idchannel = stringIDToTypeID( "channel" );
            var idtransparencyEnum = stringIDToTypeID( "transparencyEnum" );
            ref76.putEnumerated( idchannel, idchannel, idtransparencyEnum );
        desc84.putReference( idnull, ref76 );
        var idfrom = stringIDToTypeID( "from" );
            var ref77 = new ActionReference();
            var idchannel = stringIDToTypeID( "channel" );
            var idselection = stringIDToTypeID( "selection" );
            ref77.putProperty( idchannel, idselection );
        desc84.putReference( idfrom, ref77 );
    executeAction( idsubtract, desc84, DialogModes.NO );
}

function deleteMask() {
    var iddelete = stringIDToTypeID( "delete" );
        var desc498 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref432 = new ActionReference();
            var idchannel = stringIDToTypeID( "channel" );
            var idordinal = stringIDToTypeID( "ordinal" );
            var idtargetEnum = stringIDToTypeID( "targetEnum" );
            ref432.putEnumerated( idchannel, idordinal, idtargetEnum );
        desc498.putReference( idnull, ref432 );
    executeAction( iddelete, desc498, DialogModes.NO );
}

function makePointSelection(pointArray, feather, selectionType) {
    var currentRulerUnits = app.preferences.rulerUnits;
    var currentTypeUnits = app.preferences.typeUnits;
    var currentDisplayDialogs = app.displayDialogs;

    app.preferences.rulerUnits = Units.POINTS;
    app.preferences.typeUnits = TypeUnits.POINTS;
    app.displayDialogs = DialogModes.NO;

    var lineArray = [];
    for (pointIndex = 0; pointIndex < pointArray.length; pointIndex++) {
        lineArray[pointIndex] = new PathPointInfo;
        lineArray[pointIndex].kind = PointKind.CORNERPOINT;
        lineArray[pointIndex].anchor = pointArray[pointIndex];
        lineArray[pointIndex].leftDirection = lineArray[pointIndex].anchor;
        lineArray[pointIndex].rightDirection = lineArray[pointIndex].anchor;
    }
    var lineSubPathArray = new Array();
        lineSubPathArray[0] = new SubPathInfo();
        lineSubPathArray[0].operation = ShapeOperation.SHAPEXOR;
        lineSubPathArray[0].closed = false;
        lineSubPathArray[0].entireSubPath = lineArray;

    var tempPathItem = activeDocument.pathItems.add("Temp path", lineSubPathArray);
    tempPathItem.makeSelection(feather, true, selectionType);
    tempPathItem.remove();

    app.preferences.rulerUnits = currentRulerUnits;
    app.preferences.typeUnits = currentTypeUnits;
    app.displayDialogs = currentDisplayDialogs;
}

function alignCenter(layer) {
    
    if (!layer) layer = activeDocument.activeLayer;
    var centerOfDocument = [activeDocument.width.value / 2, activeDocument.height.value / 2];
    var centerOfLayer = centerCoordinates(layer);

    if (centerOfLayer[0] > centerOfDocument[0]) layer.translate((~(centerOfDocument[0] - centerOfLayer[0]) + 1), 0);
    if (centerOfLayer[0] < centerOfDocument[0]) layer.translate((~(centerOfDocument[0] - centerOfLayer[0]) + 1), 0);
    if (centerOfLayer[1] > centerOfDocument[1]) layer.translate(0, (~(centerOfDocument[1] - centerOfLayer[1]) + 1));
    if (centerOfLayer[1] < centerOfDocument[1]) layer.translate(0, (~(centerOfDocument[1] - centerOfLayer[1]) + 1));

    function centerCoordinates(layer) {
        var centerH = (layer.bounds[2].value - layer.bounds[0].value) / 2;
        var centerV = (layer.bounds[3].value - layer.bounds[1].value) / 2;
        var coordinateH = layer.bounds[0] + centerH;
        var coordinateV = layer.bounds[1] + centerV;
        return [coordinateH, coordinateV];
    }

}

function colorRange(mode, fuzziness, limit) {
    var idcolorRange = stringIDToTypeID( "colorRange" );
        var desc216 = new ActionDescriptor();
        var idcolors = stringIDToTypeID( "colors" );
        var idcolors = stringIDToTypeID( "colors" );
        var idshadows = stringIDToTypeID( mode );
        desc216.putEnumerated( idcolors, idcolors, idshadows );
        var idshadowsFuzziness = stringIDToTypeID( "shadowsFuzziness" );
        desc216.putInteger( idshadowsFuzziness, fuzziness );
        var idshadowsUpperLimit = stringIDToTypeID( "shadowsUpperLimit" );
        desc216.putInteger( idshadowsUpperLimit, limit );
        var idcolorModel = stringIDToTypeID( "colorModel" );
        desc216.putInteger( idcolorModel, 0 );
    executeAction( idcolorRange, desc216, DialogModes.NO );
}

function fillSolidColour(R, G, B) {
    var id117 = charIDToTypeID( "Mk  " );
    var desc25 = new ActionDescriptor();
    var id118 = charIDToTypeID( "null" );
    var ref13 = new ActionReference();
    var id119 = stringIDToTypeID( "contentLayer" );
    ref13.putClass( id119 );
    desc25.putReference( id118, ref13 );
    var id120 = charIDToTypeID( "Usng" );
    var desc26 = new ActionDescriptor();
    var id121 = charIDToTypeID( "Type" );
    var desc27 = new ActionDescriptor();
    var id122 = charIDToTypeID( "Clr " );
    var desc28 = new ActionDescriptor();
    var id123 = charIDToTypeID( "Rd  " );
    desc28.putDouble( id123, R ); //red
    var id124 = charIDToTypeID( "Grn " );
    desc28.putDouble( id124, G ); //green
    var id125 = charIDToTypeID( "Bl  " );
    desc28.putDouble( id125, B ); //blue
    var id126 = charIDToTypeID( "RGBC" );
    desc27.putObject( id122, id126, desc28 );
    var id127 = stringIDToTypeID( "solidColorLayer" );
    desc26.putObject( id121, id127, desc27 );
    var id128 = stringIDToTypeID( "contentLayer" );
    desc25.putObject( id120, id128, desc26 );
    executeAction( id117, desc25, DialogModes.NO );
    
    return activeDocument.activeLayer;
}

function createVibrance() {
    var idmake = stringIDToTypeID( "make" );
        var desc481 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref417 = new ActionReference();
            var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
            ref417.putClass( idadjustmentLayer );
        desc481.putReference( idnull, ref417 );
        var idusing = stringIDToTypeID( "using" );
            var desc482 = new ActionDescriptor();
            var idtype = stringIDToTypeID( "type" );
            var idvibrance = stringIDToTypeID( "vibrance" );
            desc482.putClass( idtype, idvibrance );
        var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
        desc481.putObject( idusing, idadjustmentLayer, desc482 );
    executeAction( idmake, desc481, DialogModes.NO );
}

function adjustVibrance(value) {
    var idset = stringIDToTypeID( "set" );
        var desc484 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref419 = new ActionReference();
            var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
            var idordinal = stringIDToTypeID( "ordinal" );
            var idtargetEnum = stringIDToTypeID( "targetEnum" );
            ref419.putEnumerated( idadjustmentLayer, idordinal, idtargetEnum );
        desc484.putReference( idnull, ref419 );
        var idto = stringIDToTypeID( "to" );
            var desc485 = new ActionDescriptor();
            var idsaturation = stringIDToTypeID( "saturation" );
            desc485.putInteger( idsaturation, value );
        var idvibrance = stringIDToTypeID( "vibrance" );
        desc484.putObject( idto, idvibrance, desc485 );
    executeAction( idset, desc484, DialogModes.NO );
}

function createCurves() {
    var idmake = stringIDToTypeID( "make" );
        var desc951 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref828 = new ActionReference();
            var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
            ref828.putClass( idadjustmentLayer );
        desc951.putReference( idnull, ref828 );
        var idusing = stringIDToTypeID( "using" );
            var desc952 = new ActionDescriptor();
            var idtype = stringIDToTypeID( "type" );
                var desc953 = new ActionDescriptor();
                var idpresetKind = stringIDToTypeID( "presetKind" );
                var idpresetKindType = stringIDToTypeID( "presetKindType" );
                var idpresetKindDefault = stringIDToTypeID( "presetKindDefault" );
                desc953.putEnumerated( idpresetKind, idpresetKindType, idpresetKindDefault );
            var idcurves = stringIDToTypeID( "curves" );
            desc952.putObject( idtype, idcurves, desc953 );
        var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
        desc951.putObject( idusing, idadjustmentLayer, desc952 );
    executeAction( idmake, desc951, DialogModes.NO );

    var idset = stringIDToTypeID( "set" );
        var desc982 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref843 = new ActionReference();
            var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
            var idordinal = stringIDToTypeID( "ordinal" );
            var idtargetEnum = stringIDToTypeID( "targetEnum" );
            ref843.putEnumerated( idadjustmentLayer, idordinal, idtargetEnum );
        desc982.putReference( idnull, ref843 );
        var idto = stringIDToTypeID( "to" );
            var desc983 = new ActionDescriptor();
            var idpresetKind = stringIDToTypeID( "presetKind" );
            var idpresetKindType = stringIDToTypeID( "presetKindType" );
            var idpresetKindCustom = stringIDToTypeID( "presetKindCustom" );
            desc983.putEnumerated( idpresetKind, idpresetKindType, idpresetKindCustom );
        var idcurves = stringIDToTypeID( "curves" );
        desc982.putObject( idto, idcurves, desc983 );
    executeAction( idset, desc982, DialogModes.NO );
}

function adjustCurves(points) {

    if (points.length < 2) return false;

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
        ref.putEnumerated( charIDToTypeID( "AdjL" ), charIDToTypeID( "Ordn" ), charIDToTypeID( "Trgt" ) );
        desc.putReference( charIDToTypeID( "null" ), ref );
    
    var curvesLayerDesc = new ActionDescriptor();
        curvesLayerDesc.putEnumerated( stringIDToTypeID( "presetKind" ), stringIDToTypeID( "presetKindType" ), stringIDToTypeID( "presetKindCustom" ) );
    
    var chnlList = new ActionList();
    var chnlDesc = new ActionDescriptor();
    var channelRef = new ActionReference();
        channelRef.putEnumerated( charIDToTypeID( "Chnl" ), charIDToTypeID( "Chnl" ), charIDToTypeID( "Cmps" ) );
        chnlDesc.putReference( charIDToTypeID( "Chnl" ), channelRef );
    
        var pointsList = new ActionList();

        for (var pointIndex = 0; pointIndex < points.length; pointIndex++) {
            var pointDesc = new ActionDescriptor();
                pointDesc.putDouble( charIDToTypeID( "Hrzn" ), points[pointIndex][0] );
                pointDesc.putDouble( charIDToTypeID( "Vrtc" ), points[pointIndex][1] );
                pointsList.putObject( charIDToTypeID( "Pnt " ), pointDesc );
        }
    
        chnlDesc.putList( charIDToTypeID( "Crv " ), pointsList );
        chnlList.putObject( charIDToTypeID( "CrvA" ), chnlDesc );
    
        curvesLayerDesc.putList( charIDToTypeID( "Adjs" ), chnlList );
        desc.putObject( charIDToTypeID( "T   " ), charIDToTypeID( "Crvs" ), curvesLayerDesc );
    executeAction( charIDToTypeID( "setd" ), desc, DialogModes.NO );

}

function createLevels() {
    var idmake = stringIDToTypeID( "make" );
        var desc112 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref108 = new ActionReference();
            var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
            ref108.putClass( idadjustmentLayer );
        desc112.putReference( idnull, ref108 );
        var idusing = stringIDToTypeID( "using" );
            var desc113 = new ActionDescriptor();
            var idtype = stringIDToTypeID( "type" );
                var desc114 = new ActionDescriptor();
                var idpresetKind = stringIDToTypeID( "presetKind" );
                var idpresetKindType = stringIDToTypeID( "presetKindType" );
                var idpresetKindDefault = stringIDToTypeID( "presetKindDefault" );
                desc114.putEnumerated( idpresetKind, idpresetKindType, idpresetKindDefault );
            var idlevels = stringIDToTypeID( "levels" );
            desc113.putObject( idtype, idlevels, desc114 );
        var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
        desc112.putObject( idusing, idadjustmentLayer, desc113 );
    executeAction( idmake, desc112, DialogModes.NO );
}

function adjustLevels(section, value) {
    switch (section) {
        case "gamma":
            var idset = stringIDToTypeID( "set" );
                var desc115 = new ActionDescriptor();
                var idnull = stringIDToTypeID( "null" );
                    var ref109 = new ActionReference();
                    var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
                    var idordinal = stringIDToTypeID( "ordinal" );
                    var idtargetEnum = stringIDToTypeID( "targetEnum" );
                    ref109.putEnumerated( idadjustmentLayer, idordinal, idtargetEnum );
                desc115.putReference( idnull, ref109 );
                var idto = stringIDToTypeID( "to" );
                    var desc116 = new ActionDescriptor();
                    var idpresetKind = stringIDToTypeID( "presetKind" );
                    var idpresetKindType = stringIDToTypeID( "presetKindType" );
                    var idpresetKindCustom = stringIDToTypeID( "presetKindCustom" );
                    desc116.putEnumerated( idpresetKind, idpresetKindType, idpresetKindCustom );
                    var idadjustment = stringIDToTypeID( "adjustment" );
                        var list47 = new ActionList();
                            var desc117 = new ActionDescriptor();
                            var idchannel = stringIDToTypeID( "channel" );
                                var ref110 = new ActionReference();
                                var idchannel = stringIDToTypeID( "channel" );
                                var idchannel = stringIDToTypeID( "channel" );
                                var idcomposite = stringIDToTypeID( "composite" );
                                ref110.putEnumerated( idchannel, idchannel, idcomposite );
                            desc117.putReference( idchannel, ref110 );
                            var idgamma = stringIDToTypeID( "gamma" );
                            desc117.putDouble( idgamma, value );
                        var idlevelsAdjustment = stringIDToTypeID( "levelsAdjustment" );
                        list47.putObject( idlevelsAdjustment, desc117 );
                    desc116.putList( idadjustment, list47 );
                var idlevels = stringIDToTypeID( "levels" );
                desc115.putObject( idto, idlevels, desc116 );
            executeAction( idset, desc115, DialogModes.NO );
            break;
    }
}

function createChannelMixer() {
    var idmake = stringIDToTypeID( "make" );
        var desc320 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref282 = new ActionReference();
            var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
            ref282.putClass( idadjustmentLayer );
        desc320.putReference( idnull, ref282 );
        var idusing = stringIDToTypeID( "using" );
            var desc321 = new ActionDescriptor();
            var idtype = stringIDToTypeID( "type" );
                var desc322 = new ActionDescriptor();
                var idpresetKind = stringIDToTypeID( "presetKind" );
                var idpresetKindType = stringIDToTypeID( "presetKindType" );
                var idpresetKindDefault = stringIDToTypeID( "presetKindDefault" );
                desc322.putEnumerated( idpresetKind, idpresetKindType, idpresetKindDefault );
                var idred = stringIDToTypeID( "red" );
                    var desc323 = new ActionDescriptor();
                    var idred = stringIDToTypeID( "red" );
                    var idpercentUnit = stringIDToTypeID( "percentUnit" );
                    desc323.putUnitDouble( idred, idpercentUnit, 100.000000 );
                var idchannelMatrix = stringIDToTypeID( "channelMatrix" );
                desc322.putObject( idred, idchannelMatrix, desc323 );
                var idgrain = stringIDToTypeID( "grain" );
                    var desc324 = new ActionDescriptor();
                    var idgrain = stringIDToTypeID( "grain" );
                    var idpercentUnit = stringIDToTypeID( "percentUnit" );
                    desc324.putUnitDouble( idgrain, idpercentUnit, 100.000000 );
                var idchannelMatrix = stringIDToTypeID( "channelMatrix" );
                desc322.putObject( idgrain, idchannelMatrix, desc324 );
                var idblue = stringIDToTypeID( "blue" );
                    var desc325 = new ActionDescriptor();
                    var idblue = stringIDToTypeID( "blue" );
                    var idpercentUnit = stringIDToTypeID( "percentUnit" );
                    desc325.putUnitDouble( idblue, idpercentUnit, 100.000000 );
                var idchannelMatrix = stringIDToTypeID( "channelMatrix" );
                desc322.putObject( idblue, idchannelMatrix, desc325 );
            var idchannelMixer = stringIDToTypeID( "channelMixer" );
            desc321.putObject( idtype, idchannelMixer, desc322 );
        var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
        desc320.putObject( idusing, idadjustmentLayer, desc321 );
    executeAction( idmake, desc320, DialogModes.NO );

}

function adjustChannelMixer(colour, value) {
    switch(colour) {
        case "red":
            var idset = stringIDToTypeID( "set" );
                var desc408 = new ActionDescriptor();
                var idnull = stringIDToTypeID( "null" );
                    var ref354 = new ActionReference();
                    var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
                    var idordinal = stringIDToTypeID( "ordinal" );
                    var idtargetEnum = stringIDToTypeID( "targetEnum" );
                    ref354.putEnumerated( idadjustmentLayer, idordinal, idtargetEnum );
                desc408.putReference( idnull, ref354 );
                var idto = stringIDToTypeID( "to" );
                    var desc409 = new ActionDescriptor();
                    var idred = stringIDToTypeID( "red" );
                        var desc410 = new ActionDescriptor();
                        var idred = stringIDToTypeID( "red" );
                        var idpercentUnit = stringIDToTypeID( "percentUnit" );
                        desc410.putUnitDouble( idred, idpercentUnit, value );
                    var idchannelMatrix = stringIDToTypeID( "channelMatrix" );
                    desc409.putObject( idred, idchannelMatrix, desc410 );
                var idchannelMixer = stringIDToTypeID( "channelMixer" );
                desc408.putObject( idto, idchannelMixer, desc409 );
            executeAction( idset, desc408, DialogModes.NO );
            break;
        case "green":
            var idset = stringIDToTypeID( "set" );
                var desc419 = new ActionDescriptor();
                var idnull = stringIDToTypeID( "null" );
                    var ref361 = new ActionReference();
                    var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
                    var idordinal = stringIDToTypeID( "ordinal" );
                    var idtargetEnum = stringIDToTypeID( "targetEnum" );
                    ref361.putEnumerated( idadjustmentLayer, idordinal, idtargetEnum );
                desc419.putReference( idnull, ref361 );
                var idto = stringIDToTypeID( "to" );
                    var desc420 = new ActionDescriptor();
                    var idgrain = stringIDToTypeID( "grain" );
                        var desc421 = new ActionDescriptor();
                        var idgrain = stringIDToTypeID( "grain" );
                        var idpercentUnit = stringIDToTypeID( "percentUnit" );
                        desc421.putUnitDouble( idgrain, idpercentUnit, value );
                    var idchannelMatrix = stringIDToTypeID( "channelMatrix" );
                    desc420.putObject( idgrain, idchannelMatrix, desc421 );
                var idchannelMixer = stringIDToTypeID( "channelMixer" );
                desc419.putObject( idto, idchannelMixer, desc420 );
            executeAction( idset, desc419, DialogModes.NO );
            break;
        case "blue":
            var idset = stringIDToTypeID( "set" );
                var desc429 = new ActionDescriptor();
                var idnull = stringIDToTypeID( "null" );
                    var ref367 = new ActionReference();
                    var idadjustmentLayer = stringIDToTypeID( "adjustmentLayer" );
                    var idordinal = stringIDToTypeID( "ordinal" );
                    var idtargetEnum = stringIDToTypeID( "targetEnum" );
                    ref367.putEnumerated( idadjustmentLayer, idordinal, idtargetEnum );
                desc429.putReference( idnull, ref367 );
                var idto = stringIDToTypeID( "to" );
                    var desc430 = new ActionDescriptor();
                    var idblue = stringIDToTypeID( "blue" );
                        var desc431 = new ActionDescriptor();
                        var idblue = stringIDToTypeID( "blue" );
                        var idpercentUnit = stringIDToTypeID( "percentUnit" );
                        desc431.putUnitDouble( idblue, idpercentUnit, value );
                    var idchannelMatrix = stringIDToTypeID( "channelMatrix" );
                    desc430.putObject( idblue, idchannelMatrix, desc431 );
                var idchannelMixer = stringIDToTypeID( "channelMixer" );
                desc429.putObject( idto, idchannelMixer, desc430 );
            executeAction( idset, desc429, DialogModes.NO );
            break;
    }
}

function blendIf(thisBlack, thisWhite, underBlack, underWhite) {
    var idset = stringIDToTypeID( "set" );
        var desc194 = new ActionDescriptor();
        var idnull = stringIDToTypeID( "null" );
            var ref170 = new ActionReference();
            var idlayer = stringIDToTypeID( "layer" );
            var idordinal = stringIDToTypeID( "ordinal" );
            var idtargetEnum = stringIDToTypeID( "targetEnum" );
            ref170.putEnumerated( idlayer, idordinal, idtargetEnum );
        desc194.putReference( idnull, ref170 );
        var idto = stringIDToTypeID( "to" );
            var desc195 = new ActionDescriptor();
            var idblendRange = stringIDToTypeID( "blendRange" );
                var list44 = new ActionList();
                    var desc196 = new ActionDescriptor();
                    var idchannel = stringIDToTypeID( "channel" );
                        var ref171 = new ActionReference();
                        var idchannel = stringIDToTypeID( "channel" );
                        var idchannel = stringIDToTypeID( "channel" );
                        var idgray = stringIDToTypeID( "gray" );
                        ref171.putEnumerated( idchannel, idchannel, idgray );
                    desc196.putReference( idchannel, ref171 );
                    var idsrcBlackMin = stringIDToTypeID( "srcBlackMin" );
                    desc196.putInteger( idsrcBlackMin, thisBlack[0] );
                    var idsrcBlackMax = stringIDToTypeID( "srcBlackMax" );
                    desc196.putInteger( idsrcBlackMax, thisBlack[1] );
                    var idsrcWhiteMin = stringIDToTypeID( "srcWhiteMin" );
                    desc196.putInteger( idsrcWhiteMin, thisWhite[0] );
                    var idsrcWhiteMax = stringIDToTypeID( "srcWhiteMax" );
                    desc196.putInteger( idsrcWhiteMax, thisWhite[1] );
                    var iddestBlackMin = stringIDToTypeID( "destBlackMin" );
                    desc196.putInteger( iddestBlackMin, underBlack[0] );
                    var iddestBlackMax = stringIDToTypeID( "destBlackMax" );
                    desc196.putInteger( iddestBlackMax, underBlack[1] );
                    var iddestWhiteMin = stringIDToTypeID( "destWhiteMin" );
                    desc196.putInteger( iddestWhiteMin, underWhite[0] );
                    var iddesaturate = stringIDToTypeID( "desaturate" );
                    desc196.putInteger( iddesaturate, underWhite[1] );
                var idblendRange = stringIDToTypeID( "blendRange" );
                list44.putObject( idblendRange, desc196 );
            desc195.putList( idblendRange, list44 );
        var idlayer = stringIDToTypeID( "layer" );
        desc194.putObject( idto, idlayer, desc195 );
    executeAction( idset, desc194, DialogModes.NO );
}

function moveLayerUpOrDown(Direction) {

	switch(Direction.toLowerCase()) {
		case 'up' : Direction = 'Nxt '; break;
		case 'down' : Direction = 'Prvs'; break;
		default : Direction = 'Prvs'; break;
	}
	var desc = new ActionDescriptor();
	var ref = new ActionReference();
	ref.putEnumerated(charIDToTypeID('Lyr '),charIDToTypeID('Ordn'),charIDToTypeID('Trgt') );
	desc.putReference(charIDToTypeID('null'), ref );
	var ref2 = new ActionReference();
	ref2.putEnumerated(charIDToTypeID('Lyr '),charIDToTypeID('Ordn'),charIDToTypeID(Direction) );
	try {
		desc.putReference(charIDToTypeID('T   '), ref2 ); executeAction(charIDToTypeID('move'), desc, DialogModes.NO );
	} catch(e) {}
	
}

function timeSinceStart(start) {
    if (start == null) return null;
    var d = new Date();
    var timeNow = d.getTime() / 1000;
    return timeNow - start;
}

function formatSeconds(sec) {
    String.prototype.repeat = function(x) {
        var str = "";
        for (var repeats = 0; repeats < x; repeats++) str = str + this;
        return str;
    };
    Number.prototype.twoDigits = function() {
        if (this == 0) return ('0'.repeat(2));
        var dec = this / (Math.pow(10, 2));
        if (String(dec).substring(String(dec).lastIndexOf(".") + 1, String(dec).length).length == 1) dec = dec + "0";
        var str = dec.toString().substring(2, dec.toString().length);
        return str;
    };
    var hours = Math.floor(sec / 60 / 60);
    var minutes = Math.floor(sec / 60) - (hours * 60);
    var seconds = sec % 60;
    return Math.floor(hours).twoDigits() + ':' + Math.floor(minutes).twoDigits() + ':' + Math.floor(seconds).twoDigits();
}

function saveAsJPG(folder, name) {
    if (!folder.exists) folder.create();
    jpgFile = new File(folder + "/" + name + ".jpg");
    jpgSaveOptions = new JPEGSaveOptions();
    jpgSaveOptions.embedColorProfile = true;
    jpgSaveOptions.formatOptions = FormatOptions.STANDARDBASELINE;
    jpgSaveOptions.matte = MatteType.NONE;
    jpgSaveOptions.quality = 8;
    activeDocument.saveAs(jpgFile, jpgSaveOptions, true, Extension.LOWERCASE);
    return jpgFile;
}