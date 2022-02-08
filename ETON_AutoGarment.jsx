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

var lyr_GrpSamplesGarm;
var minimumFilter = 200;
var samplesArray = [];
var samplesRef = [];
var samplesGarm = [];
var grp_Garment;
var grp_Ref;
var cleanRGB;
var gradientSteps = 4;
var blendIfSpan = Math.round(255 / gradientSteps);

try {
    init();
} catch(e) {
    alert("Error code " + e.number + " (line " + e.line + "):\n" + e);
}

// Reset the ruler
app.preferences.rulerUnits = startRulerUnits;
app.preferences.typeUnits = startTypeUnits;
app.displayDialogs = startDisplayDialogs;

function init() {
    
    // Preparation before running the main script
    try {
        activeDocument.activeLayer = activeDocument.layers.getByName("Group 1").layerSets.getByName("Garment");
        grp_Garment = activeDocument.activeLayer;
    } catch(e) {
        return alert("No Garment group found");
    }
    try {
        activeDocument.activeLayer = activeDocument.layers.getByName("Garment Colour Match");
        grp_Ref = activeDocument.activeLayer;
    } catch(e) {
        return alert("No Garment Colour Match group found");
    }
    if (grp_Garment.layers.length != 0) {
        for (i = 0; i < grp_Garment.layers.length; i++) {
            grp_Garment.layers[i].visible = false;
        }
    }
    
    main();

}

function main() {

    // ----- Auto ref -----
    grp_Ref.visible = true;
    activeDocument.activeLayer = grp_Ref.layers[0];
    activeDocument.activeLayer.visible = true;
    var lyrHeightInPt = activeDocument.activeLayer.bounds[3].as('pt') - activeDocument.activeLayer.bounds[0].as('pt');
        
    // Select Subject
    selectSubject(false);
    activeDocument.selection.contract(new UnitValue (30, "px"));
    makePointSelection([[0, 0],[activeDocument.width.as('pt'), 0],[activeDocument.width.as('pt'), lyrHeightInPt / 3 + activeDocument.activeLayer.bounds[1].as('pt')], [0, lyrHeightInPt / 3 + activeDocument.activeLayer.bounds[1].as('pt')]], 0, SelectionType.DIMINISH);
    activeDocument.selection.copy();
    grp_Ref.visible = false;
    var lyr_MatchGrp = activeDocument.layerSets.add();
    activeDocument.activeLayer.name = "Auto match";
    var lyr_AutoRef = activeDocument.paste();
    activeDocument.activeLayer.name = "Auto - Ref";
    alignCenter();
    var lyr_FillAuto = fillSolidColour(0, 0, 0);
    moveLayerUpOrDown("Down");

    // Get brightness sample for Ref
    activeDocument.activeLayer = lyr_AutoRef;
    var preBlendIf = app.activeDocument.activeHistoryState;
    layerSelection();
    var idAvrg = charIDToTypeID( "Avrg" );
    executeAction( idAvrg, undefined, DialogModes.NO );
    activeDocument.selection.deselect();
    lyr_AutoRef.desaturate();
    getSample();
    var refBrightness = cleanRGB;
    app.activeDocument.activeHistoryState = preBlendIf;

    // Get RGB samples for Ref
    for (i = 0; i < gradientSteps; i++) {
        activeDocument.activeLayer = lyr_AutoRef;
        var preBlendIf = app.activeDocument.activeHistoryState;
        samplesRef.push(averageBlendIf([blendIfSpan * i, blendIfSpan * i], [blendIfSpan * (i + 1), blendIfSpan * (i + 1)], [0, 0], [255, 255]));
        app.activeDocument.activeHistoryState = preBlendIf;
    }

    lyr_AutoRef.remove();

    // ----- Auto garment -----
    activeDocument.activeLayer = grp_Garment;

    // Selection from mask
    selectionFromMask();
    activeDocument.selection.contract(new UnitValue (30, "px"));
    activeDocument.activeLayer = lyr_FillAuto;
    lyr_FillAuto.visible = false;
    activeDocument.selection.copy(true);
    lyr_FillAuto.visible = true;
    var lyr_AutoGarm = activeDocument.paste();
    alignCenter();

    // Get brightness sample for Garm
    activeDocument.activeLayer = lyr_AutoGarm;
    var preBlendIf = app.activeDocument.activeHistoryState;
    layerSelection();
    var idAvrg = charIDToTypeID( "Avrg" );
    executeAction( idAvrg, undefined, DialogModes.NO );
    activeDocument.selection.deselect();
    lyr_AutoGarm.desaturate();
    getSample();
    var garmBrightness = cleanRGB;
    app.activeDocument.activeHistoryState = preBlendIf;

    // Get RGB samples for Garm
    for (i = 0; i < gradientSteps; i++) {
        activeDocument.activeLayer = lyr_AutoGarm;
        var preBlendIf = app.activeDocument.activeHistoryState;
        samplesGarm.push(averageBlendIf([blendIfSpan * i, blendIfSpan * i], [blendIfSpan * (i + 1), blendIfSpan * (i + 1)], [0, 0], [255, 255]));
        app.activeDocument.activeHistoryState = preBlendIf;
    }

    lyr_AutoGarm.remove();
    lyr_MatchGrp.remove();

    // Create samples for garment
    var currentRulerUnits = app.preferences.rulerUnits;
    var currentTypeUnits = app.preferences.typeUnits;
    var currentDisplayDialogs = app.displayDialogs;

    app.preferences.rulerUnits = Units.POINTS;
    app.preferences.typeUnits = TypeUnits.POINTS;
    app.displayDialogs = DialogModes.NO;

    activeDocument.activeLayer = grp_Garment;
    lyr_GrpSamplesGarm = activeDocument.layerSets.add();
    lyr_GrpSamplesGarm.name = "Auto - Samples Garment";
    var sampleSize = 10;
    var sampleStartX = 0;
    var sampleStartY = 0;

    // Sample for brightness
    createSamples([[sampleStartX, sampleStartY], [sampleStartX + sampleSize, sampleStartY], [sampleStartX + sampleSize, sampleStartY + sampleSize], [sampleStartX, sampleStartY + sampleSize]], garmBrightness);
    sampleStartY = sampleStartY + sampleSize;
    // Sample for RGB
    for (i = 0; i < gradientSteps; i++) {
        createSamples([[sampleStartX, sampleStartY], [sampleStartX + sampleSize, sampleStartY], [sampleStartX + sampleSize, sampleStartY + sampleSize], [sampleStartX, sampleStartY + sampleSize]], samplesGarm[i]);
        sampleStartY = sampleStartY + sampleSize;
    }

    // Create samples for ref
    activeDocument.activeLayer = grp_Ref;
    var lyr_GrpSamplesRef = activeDocument.layerSets.add();
    lyr_GrpSamplesRef.name = "Auto - Samples Reference";
    var sampleSize = 10;
    var sampleStartX = 10;
    var sampleStartY = 0;

    // Sample for brightness
    createSamples([[sampleStartX, sampleStartY], [sampleStartX + sampleSize, sampleStartY], [sampleStartX + sampleSize, sampleStartY + sampleSize], [sampleStartX, sampleStartY + sampleSize]], refBrightness);
    sampleStartY = sampleStartY + sampleSize;
    // Sample for RGB
    for (i = 0; i < gradientSteps; i++) {
        createSamples([[sampleStartX, sampleStartY], [sampleStartX + sampleSize, sampleStartY], [sampleStartX + sampleSize, sampleStartY + sampleSize], [sampleStartX, sampleStartY + sampleSize]], samplesRef[i]);
        sampleStartY = sampleStartY + sampleSize;
    }

    app.preferences.rulerUnits = currentRulerUnits;
    app.preferences.typeUnits = currentTypeUnits;
    app.displayDialogs = currentDisplayDialogs;

    // Create garment adjustment layers
    activeDocument.activeLayer = lyr_GrpSamplesGarm;
    createLevels();
    var lyr_Levels = activeDocument.activeLayer;
    lyr_Levels.name = "Levels";
    deleteMask();

    var chMxArray = [];
    for (i = 0; i < gradientSteps; i++) {
        createChannelMixer();
        chMxArray.push(activeDocument.activeLayer);
        activeDocument.activeLayer.name = "Channel Mixer (" + (blendIfSpan * i) + "-" + (blendIfSpan * (i + 1)) + ")";
        blendIf([blendIfSpan * i, blendIfSpan * i], [blendIfSpan * (i + 1), blendIfSpan * (i + 1)], [0, 0], [255, 255]);
    }

    app.refresh();

    // Adjust garment adjustment layers
    activeDocument.activeLayer = lyr_GrpSamplesGarm;
    adjustLevelsToMatch(lyr_Levels, samplesArray[0], samplesArray[gradientSteps + 1]);

    for (i = 0; i < gradientSteps; i++) {
        adjustRgbToMatch(chMxArray[i], samplesArray[i + 1], samplesArray[(gradientSteps + 2) + i]);
    }

    lyr_Levels.move(grp_Garment, ElementPlacement.INSIDE);
    for (i = 0; i < gradientSteps; i++) {
        chMxArray[i].move(grp_Garment, ElementPlacement.INSIDE);
    }

    return;
    
    TODO: // Need more reliable way to get the average colour of a BlendIf span that is small!
    TODO: // Stuff below needs to be iterated! <3

    // Clean-up
    activeDocument.colorSamplers.removeAll();
    lyr_GrpSamplesGarm.remove();
    lyr_GrpSamplesRef.remove();

    // Change Blend If values and add Vibrance layers
    activeDocument.activeLayer = chMix_Lows;
    deleteMask();
    blendIf([0, 0], [255, 255], [0, 0], [0, 85]);
    createVibrance();
    adjustVibrance(-100);
    blendIf([0, 0], [255, 255], [0, 0], [0, 85]);
    activeDocument.activeLayer.name = "Vibrance (0-85)";
    activeDocument.activeLayer.opacity = 50.0;
    deleteMask();
    activeDocument.activeLayer = chMix_Mids;
    deleteMask();
    blendIf([0, 0], [255, 255], [0, 127], [128, 255]);
    createVibrance();
    adjustVibrance(-100);
    blendIf([0, 0], [255, 255], [0, 127], [128, 255]);
    activeDocument.activeLayer.name = "Vibrance (85-170)";
    activeDocument.activeLayer.opacity = 0.0;
    deleteMask();
    activeDocument.activeLayer = chMix_Highs;
    deleteMask();
    blendIf([0, 0], [255, 255], [170, 212], [255, 255]);
    createVibrance();
    adjustVibrance(-100);
    blendIf([0, 0], [255, 255], [170, 212], [255, 255]);
    activeDocument.activeLayer.name = "Vibrance (170-255)";
    activeDocument.activeLayer.opacity = 0.0;
    deleteMask();

}

// FUNCTIONS

function adjustRgbToMatch(lyr, sampleA, sampleB) {

    if (sampleA.color.rgb.red == 0 && sampleA.color.rgb.green == 0 && sampleA.color.rgb.blue == 0) return;

    var timeout = 20;
    var startValue = 100;
    if (sampleA.color.rgb.red < sampleB.color.rgb.red) {
        while (sampleA.color.rgb.red < sampleB.color.rgb.red) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("red", startValue);
            activeDocument.activeLayer = lyr_GrpSamplesGarm;
            startValue++;
            timeout--;
            if (timeout <= 0) break;
        }
    } else {
        while (sampleA.color.rgb.red > sampleB.color.rgb.red) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("red", startValue);
            activeDocument.activeLayer = lyr_GrpSamplesGarm;
            startValue--;
            timeout--;
            if (timeout <= 0) break;
        }
    }
    var timeout = 20;
    var startValue = 100;
    if (sampleA.color.rgb.green < sampleB.color.rgb.green) {
        while (sampleA.color.rgb.green < sampleB.color.rgb.green) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("green", startValue);
            activeDocument.activeLayer = lyr_GrpSamplesGarm;
            startValue++;
            timeout--;
            if (timeout <= 0) break;
        }
    } else {
        while (sampleA.color.rgb.green > sampleB.color.rgb.green) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("green", startValue);
            activeDocument.activeLayer = lyr_GrpSamplesGarm;
            startValue--;
            timeout--;
            if (timeout <= 0) break;
        }
    }
    var timeout = 20;
    var startValue = 100;
    if (sampleA.color.rgb.blue < sampleB.color.rgb.blue) {
        while (sampleA.color.rgb.blue < sampleB.color.rgb.blue) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("blue", startValue);
            activeDocument.activeLayer = lyr_GrpSamplesGarm;
            startValue++;
            timeout--;
            if (timeout <= 0) break;
        }
    } else {
        while (sampleA.color.rgb.blue > sampleB.color.rgb.blue) {
            activeDocument.activeLayer = lyr;
            adjustChannelMixer("blue", startValue);
            activeDocument.activeLayer = lyr_GrpSamplesGarm;
            startValue--;
            timeout--;
            if (timeout <= 0) break;
        }
    }
}

function adjustLevelsToMatch(lyr, sampleA, sampleB) {
    var timeout = 20;
    var startValue = 1.000000;
    if (sampleA.color.rgb.red < sampleB.color.rgb.red) {
        while (sampleA.color.rgb.red < sampleB.color.rgb.red) {
            activeDocument.activeLayer = lyr;
            adjustLevels(startValue);
            activeDocument.activeLayer = lyr_GrpSamplesGarm;
            startValue = startValue + 0.01;
            timeout--;
            if (timeout <= 0) break;
        }
    } else {
        while (sampleA.color.rgb.red > sampleB.color.rgb.red) {
            activeDocument.activeLayer = lyr;
            adjustLevels(startValue);
            activeDocument.activeLayer = lyr_GrpSamplesGarm;
            startValue = startValue - 0.01;
            timeout--;
            if (timeout <= 0) break;
        }
    }
}

function createSamples(coordinates, rgb) {
    makePointSelection(coordinates, 0, SelectionType.REPLACE);
    fillSolidColour(rgb[0], rgb[1], rgb[2]);
    selectionFromMask();
    var daSample = activeDocument.colorSamplers.add([activeDocument.selection.bounds[0].as('pt') + 1, activeDocument.selection.bounds[1].as('pt') + 1]);
    activeDocument.selection.deselect();
    samplesArray.push(daSample);
}

function averageBlendIf(thisBlack, thisWhite, underBlack, underWhite) {

    blendIf(thisBlack, thisWhite, underBlack, underWhite);
    colorRange("shadows", 0, 0);
    activeDocument.selection.contract(new UnitValue (1, "px"));
    try {
        if (activeDocument.selection.bounds) activeDocument.selection.clear();
    } catch(e) {
        return [255, 255, 255];
    }
    activeDocument.selection.deselect();
    blendIf([0, 0], [255, 255], [0, 0], [255, 255]);

    try {
        alignCenter();
    } catch(e) {
        return [255, 255, 255];
    }
    
    // Average
    layerSelection();
    var idAvrg = charIDToTypeID( "Avrg" );
    executeAction( idAvrg, undefined, DialogModes.NO );
    activeDocument.selection.deselect();
    
    layerSelection();
    activeDocument.selection.contract(new UnitValue (2, "px"));
    activeDocument.selection.invert();
    try {
        if (activeDocument.selection.bounds) activeDocument.selection.clear();
    } catch(e) {
        return [255, 255, 255];
    }
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

function selectSubject(sampleAllLayers) {
    var idautoCutout = stringIDToTypeID( "autoCutout" );
        var desc16 = new ActionDescriptor();
        var idsampleAllLayers = stringIDToTypeID( "sampleAllLayers" );
        desc16.putBoolean( idsampleAllLayers, sampleAllLayers );
    executeAction( idautoCutout, desc16, DialogModes.NO );
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

function adjustLevels(value) {
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