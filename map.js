import SceneView from '@arcgis/core/views/SceneView'
import Map from '@arcgis/core/Map'
import Basemap from '@arcgis/core/Basemap'
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import LabelClass from "@arcgis/core/layers/support/LabelClass.js";
import ValuePicker from "@arcgis/core/widgets/ValuePicker";
import SceneLayer from "@arcgis/core/layers/SceneLayer";
let prev = 0;
const base = new Basemap({
  portalItem: {
    id: "0560e29930dc4d5ebeb58c635c0909c9"
  }
});
const trees = new SceneLayer({
  portalItem: {
    id: '084d7bb129ab4168a1d878cfa76175e5'
  }
});
const map = new Map({ basemap: base, ground: "world-elevation" });

const lines = new FeatureLayer({
  portalItem: {
    id: 'e2ef7f5a8c2b46d3ba364f379a65f509',
    portal: {
      url: 'https://mapstest.raleighnc.gov/portal'
    }
  }
});
const table = new FeatureLayer({
  url: 'https://mapstest.raleighnc.gov/hosted/rest/services/Hosted/turnmovements_rel2/FeatureServer/1'
});


export async function setupMap(element) {
  const view = new SceneView({
    map: map, container: element, camera: {
      tilt: 45, position: {
        x: -78.687002,
        y: 35.784995,
        z: 400
  
      }
    }
  });  
  view.map.add(trees);
  await view.when();
  const valuePicker = setupPicker();
  view.ui.add(valuePicker, "top-right");
  const turns = await getTurns(lines);
  turns.fields.push({
    name: "count_veh",
    alias: "Count",
    type: "integer"
  });
  view.goTo(lines.fullExtent)
  const vizlayer = new FeatureLayer({
    source: turns.features,
    fields: turns.fields,
    geometryType: turns.geometryType,
    spatialReference: turns.spatialReference,
    renderer: setLineRenderer(),
    popupTemplate: turns.popupTemplate,
    popupsEnabled: true,
    labelingInfo: [setLabelClass()],
    labelsVisible: true,
    opacity: 0.5
  });
  map.add(vizlayer);

  // valuePicker.on("animate", async e => {
  //   valueChanged(vizlayer, valuePicker, turns, table);
  // });
  // valuePicker.on("next", async e => {
  //   valueChanged(vizlayer, valuePicker, turns, table);
  // });

  // valuePicker.on("previous", async e => {
  //   valueChanged(vizlayer, valuePicker, turns, table);
  // });

  valuePicker.watch('values', async e => {
    valueChanged(vizlayer, valuePicker, turns, table);
  });

  const results = await getTurnCount(table);
  turns.features.forEach(turn => {
    const match = results.features.find(result => result.getAttribute('rddir') === turn.getAttribute('turns'));
    if (match) {
      turn.setAttribute('count_veh', match.getAttribute('count'));
    }
  });
  await vizlayer.applyEdits({ updateFeatures: turns.features });
}


function setupPicker() {
  const valuePicker = new ValuePicker({
    component: {
      type: "slider",
      min: 0,                                             
      max: 100,                                               
      steps: Array.from(Array(100).keys()),      
      minorTicks: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95],     
      majorTicks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 
      labels: [0, 20, 40, 60, 80, 100],
      labelFormatFunction: (value) => `${value}`
    },
    values: [0],
    playRate: 50,
    loop: true
  });
  return valuePicker;
}

async function getTurns(layer) {
  return await layer.queryFeatures();
}
async function getTurnCount(table) {
  return await table.queryFeatures({
    where: '1=1',
    outStatistics: [{
      onStatisticField: "rddir",
      outStatisticFieldName: "count",
      statisticType: "count"
    }],
    outFields: 'count',
    groupByFieldsForStatistics: 'rddir'
  });
}

async function resetCounts(valuePicker, vizlayer, table, turns) {
  valuePicker.playRate = 100;
  const results = await getTurnCount(table);
  turns.features.forEach(turn => {
    const match = results.features.find(result => result.getAttribute('rddir') === turn.getAttribute('turns'));
    if (match) {
      turn.setAttribute('count_veh', match.getAttribute('count'));
    }
  });
  await vizlayer.applyEdits({ deleteFeatures: turns.features })
  await vizlayer.applyEdits({ addFeatures: turns.features });
  valuePicker.playRate = 50
}
async function updateCounts(valuePicker, vizlayer, didIncrease) {
  const result = await vizlayer.queryFeatures({ where: "1=1" });
  result.features.forEach(feature => {
    feature.setAttribute('count_veh', didIncrease ? feature.getAttribute('count_veh') + (valuePicker.values[0] / 5) : feature.getAttribute('count_veh') - (valuePicker.values[0] / 5) );
  });
  await vizlayer.applyEdits({ updateFeatures: result.features });
}
async function valueChanged(vizlayer, valuePicker, turns, table) {
  if (valuePicker.values[0] === 0) {
    await resetCounts(valuePicker, vizlayer, table, turns);
  } else {
    await  updateCounts(valuePicker, vizlayer, valuePicker.values[0] > prev);
  }  
  prev = valuePicker.values[0];
}

function setLineRenderer() {
  return {
    type: "simple", symbol: {
      type: "line-3d",
      symbolLayers: [{
        type: "path",
        profile: "circle",
        width: 1,
        material: { color: "#ff7380" },
        cap: "square",
        profileRotation: "heading"
      }],
      castShadows: true
    },
    visualVariables: [
      {
        type: "color",
        field: "count_veh",
        stops: [{ value: 0, color: "white" }, { value: 100, color: "red" }]
      },
      {
        type: "size",
        field: "count_veh",
        stops: [{ value: 0, size: 1 }, { value: 1000, size: 100 }],
        axis: "height"
      },
      {
        type: "size",
        axis: "width-and-depth",
        useSymbolValue: true
      }
    ]
  };
}

function setLabelClass() {
  return new LabelClass({
    symbol: {
      type: "label-3d",
      symbolLayers: [
        {
          type: "text",
          font: { family: 'Orbitron', style: 'normal', weight: 'bold' },
          material: {
            color: "black"
          },
          size: 14,
          halo: {
            color: "white",
            size: 2
          }
        }
      ],
      verticalOffset: {
        screenLength: 75,
        maxWorldLength: 1000,
        minWorldLength: 20
      },
      callout: {
        type: "line",
        size: 0.5,
        color: [0, 0, 0],
        border: {
          color: [255, 255, 255, 0.7]
        }
      }
    },
    labelPlacement: "above-center",
    labelExpressionInfo: {
      expression: '$feature.count_veh'
    }
  });
}

