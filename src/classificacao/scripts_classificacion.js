var visualize = {
    mosaico: {
        min: [0, 1000, 0], 
        max: [3000, 4000, 3000],
        bands: ['SWIR2', 'NIR', 'Red']
    },
    map_notfire: {min: 0.5, max: 1, palette: ['#ffffff', '#0000ff']},
    map_fire: {min:0, max:1, palette:['#ffffff', '#ff0000']},
    map_NOA:  {
            min: 280.0,            max: 400.0,
            palette: ['yellow', 'orange', 'red', 'white', 'darkred'],
        }
};

var asset1d = 'users/ekhiroteta/BAMT/BAMT_GEE_downloadableTiles_1d';
var asset2d = 'users/ekhiroteta/BAMT/BAMT_GEE_downloadableTiles_2d';
var asset_studio = 'projects/dsak-463213/assets/sep_geofogo/SETOR_NORTE';
var asset_logo = 'projects/ee-diegosilvaotca/assets/logo2';
var grade_1d  = ee.FeatureCollection(asset1d);
var grade_2d  = ee.FeatureCollection(asset2d);
var studyArea = ee.FeatureCollection(asset_studio);

var list_regions_orig = tiles_2d.filterBounds(studyArea);
var list_regions = tiles_2d.filterBounds(studyArea);
// colocando um metadado para criar mascaras 
list_regions = list_regions.map(function(feat){return feat.set('id_codigo', 1)})
var lst_idCod_reg = list_regions.reduceColumns(ee.Reducer.toList(2), ['TILE', 'PROJ']).get('list');

var date_1 = '2023-12-01';  
var date_2 = '2024-01-01'; 
var date_3 = '2024-01-31';         
var dataset = 'Sentinel';   
var identifier = 'BAMT'; 
var UMLError_tiles_1d = [];   
var UMLError_tiles_05d = [];
var UMLError_tiles_025d = [];  
var list_bands = ['B2', 'B3', 'B4', 'B8A', 'B11', 'B12'];
var list_band_L5 =['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'];
var list_band_L7 =['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'];
var list_band_name = ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2'];
var band_list = ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2', 'NBR2', 'NBR', 'NDVI'];
var lst_band_totrain = [];
var show_fireCCI_MODI = false;
var export_drive = true;
var diff_image = ee.Image().toUint16();

      
//Map.centerObject(studyArea,10);
// vamos convertir la área de estudo em uma mascara para sustituir la función clip por updateMask
studyArea = studyArea.map(function(feat){return feat.set('id_code', 1)});
var mask_study_area = studyArea.reduceToImage(['id_code'], ee.Reducer.first());


function export_raster_classified(raster_fire, name_export, ngeom, export_to_drive){
    var param_export;
    if (export_to_drive) {
        param_export = {
            collection: raster_fire, 
            description: name_export + '_SHP', 
            folder: 'BAMT_GEE_feb25', 
            fileFormat: 'SHP', 
            selectors: ['BurnDate']
        }
        Export.table.toDrive({});
    }else{
        param_export = {
            collection: raster_fire, 
            description: name_export + '_SHP', 
            assetId: 'BAMT_BA/'+ name_export + '_SHP'
        }
        Export.table.toAsset(param_export);
    }
    print(" exporting ⚡️ " +  name_export + '_SHP');
}

function apply_masking_cloud_s2(image) {
    var date = ee.Number.parse(ee.Date(image.get('system:time_start')).format('yyyyMMdd'));
    /*var QABand = image.select('QA60');
    var B1Band = image.select('B1');
    var mask = QABand.bitwiseAnd(ee.Number(2).pow(10).int())
        .or(QABand.bitwiseAnd(ee.Number(2).pow(11).int()))
        .or(B1Band.gt(1500));
    image = image.select(['B2', 'B3', 'B4', 'B8A', 'B11', 'B12'])
        .rename(['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2']);
    return image.updateMask(mask.eq(0)).clip(studyArea).set('date', date);
    */
    // Crear la máscara de nubes usando umbrales para las bandas seleccionadas
    var mask =  image.select('B2').gt(2000) // Umbral para la banda azul (B2)
                        .or(image.select('B11').gt(3000)) // Umbral para la banda infrarroja de onda corta (B11)
                        .or(image.select('B12').gt(3000)); // Umbral para la banda infrarroja de onda corta (B12)
    
    // Seleccionar las bandas deseadas y renombrarlas
    image = image.select(list_bands).rename(list_band_name);
    return image.updateMask(mask_study_area).updateMask(mask.not()).set('date', date);
};

function mask_landsat(image) {
    var date = ee.Number.parse(ee.Date(image.get('system:time_start')).format('yyyyMMdd'));
    var mask = image.select('QA_PIXEL').bitwiseAnd(ee.Number(2).pow(3).int()).eq(0)
                    .and(image.select('QA_PIXEL').bitwiseAnd(ee.Number(2).pow(4).int()).eq(0));
    var satellite = ee.String(image.get('SPACECRAFT_ID'));
    image = ee.Image(
                ee.Algorithms.If(
                        satellite.compareTo('LANDSAT_4').eq(0)
                                    .or(satellite.compareTo('LANDSAT_5').eq(0))
                                    .or(satellite.compareTo('LANDSAT_7').eq(0)),
                        image.select(list_band_L5),
                        image.select(list_band_L7)                                    
                ));
    image = image.multiply(0.0000275).add(-0.2).multiply(10000)
                .rename(list_band_name)

    return image.updateMask(mask.eq(1)).updateMask(mask_study_area).set('date', date);
}

function filterMonthsMCD64(month, parameters) {
    parameters = ee.List(parameters);
    var image_list = ee.List(parameters.get(0));
    var date_pre = ee.Date(parameters.get(1));
    var date_post = ee.Date(parameters.get(2));
    
    var month_date = ee.Date(month.get('system:time_start'));
    month = ee.Image(ee.Algorithms.If(
        month_date.difference(date_pre.update({day: 1}), 'day').eq(0),
        month.gte(ee.Number.parse(date_pre.format('DD'))),
        ee.Algorithms.If(
            month_date.difference(date_post.update({day: 1}), 'day').eq(0),
            month.gt(0).and(month.lt(ee.Number.parse(date_post.format('DD')))),
            month.gt(0)
        )
        ));
    image_list = image_list.add(month);
    
    return ee.List([image_list, date_pre, date_post]);
}

function filterDatesMCD64(date_pre, date_post) {
    date_pre = ee.Date(date_pre);
    date_post = ee.Date(date_post);
    var mcd64 = ee.ImageCollection('MODIS/061/MCD64A1')
                    .filterDate(date_pre.update({day: 1}), date_post)
                    .select('BurnDate');
    
    var parameters = ee.List([ee.List([]), date_pre, date_post]);
    mcd64 = ee.ImageCollection(ee.List(ee.List(mcd64.iterate(filterMonthsMCD64, parameters)).get(0)))
                            .sum().gt(0);
    mcd64 = mcd64.updateMask(mcd64.eq(1));    
    return mcd64;
}
function filterDatesFireCCI51(date_pre, date_post) {
    date_pre = ee.Date(date_pre);
    date_post = ee.Date(date_post);
    var mcd64 = ee.ImageCollection('ESA/CCI/FireCCI/5_1')
                    .filterDate(date_pre.update({day:1}), date_post)
                    .select('BurnDate');
    
    var parameters = ee.List([ee.List([]), date_pre, date_post]);
    mcd64 = ee.ImageCollection(ee.List(ee.List(mcd64.iterate(filterMonthsMCD64, parameters)).get(0)))
                .sum().gt(0);
    mcd64 = mcd64.updateMask(mcd64.eq(1));
    
    return mcd64;
};

// aplicar o calculo de todos os spectral index]
function apply_spectral_index (image) {     
    var dates = image.metadata('date');
    //  Índice de Queima Normalizado (NBR)
    var nbr2 = image.normalizedDifference(['SWIR2', 'SWIR1']).rename(['NBR2']);
    //  Índice de Queima Normalizado (NBR)
    var nbr = image.normalizedDifference(['SWIR2', 'NIR']).rename(['NBR']);
    // NDVI (Normalized Difference Vegetation Index)
    var ndvi = image.normalizedDifference(['NIR', 'Red']).rename(['NDVI']);
    
    return image.addBands([nbr2, nbr, ndvi])
                .addBands(dates.rename('dates'));
}

function view_data() {
    Map.clear();
    Map.setOptions('HYBRID');
   
    var tile;
    
    nameBase = 'BAMT_BA_' + identifier + '_';

    // pre- and post-fire images
    var pre_image;
    var post_image;
    switch (dataset) {
        case 'Landsat':
            nameBase = nameBase + 'Lndst';
            pixelSize = 30;
            // .filterDate(date_1, date_2)  .filterBounds(studyArea)
            // Juntando todas as coleções de Landsat
            allCollection =  ee.ImageCollection('LANDSAT/LT04/C02/T1_L2')
                                    .merge(ee.ImageCollection('LANDSAT/LT05/C02/T1_L2'))
                                    .merge(ee.ImageCollection('LANDSAT/LE07/C02/T1_L2'))
                                    .merge(ee.ImageCollection('LANDSAT/LC08/C02/T1_L2'))
                                    .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))

            pre_image = allCollection.filterBounds(studyArea)
                            .filterDate(date_1, date_2)
                            .map(mask_landsat);

            post_image = allCollection.filterBounds(studyArea)
                            .filterDate(date_2, date_3)
                            .map(mask_landsat);
            break;
        case 'Sentinel':
            nameBase = nameBase + 'S2MSI';
            pixelSize = 20;
            pre_image = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
                                            .filterBounds(studyArea)
                                            .filterDate(date_1, date_2)
                                            .map(apply_masking_cloud_s2);
            post_image = ee.ImageCollectiondate1.slice(0, 8) .filterDate(date_2, date_3)
                                            .map(apply_masking_cloud_s2);
            break;
    }
    // addicionar todas as bandas de indices espectrais  NBR, NBR2, NDVI
    pre_image = pre_image.map(apply_spectral_index);
    post_image = post_image.map(apply_spectral_index);
       

    post_image = post_image.qualityMosaic('NBR');
    pre_image = pre_image.qualityMosaic('NBR');
    date_image = post_image.select('dates').int();

    Map.addLayer(pre_image.select(['SWIR2', 'NIR', 'Red']), visualize.mosaico, 'Pre-fire', false);
    Map.addLayer(post_image.select(['SWIR2', 'NIR', 'Red']) ,  visualize.mosaico, 'Post-fire');
    //Map.addLayer(post_image_rgb.subtract(pre_image_rgb), {min:-100, max:100}, 'Difference', false);

    if (show_fireCCI_MODI){
        var mcd64 = ee.Algorithms.If(
            ee.Algorithms.IsEqual(
                ee.Number(ee.Date(date_3).get('year')).gt(ee.Number(2000)), 1),
            filterDatesMCD64(date_2, date_3),
            ee.Image().byte()
        )
        var fcci = ee.Algorithms.If(
            ee.Algorithms.IsEqual(
                ee.Number(ee.Date(date_3).get('year')).gt(ee.Number(2001)), 1),            
            filterDatesFireCCI51(date_2, date_3),
             ee.Image().byte()
        )
        Map.addLayer(mcd64, {min:0, max:1, palette:['#000000', '#ff0000']}, 'MCD64A1', true);
        Map.addLayer(fcci, {min:0, max:1, palette:['#000000', '#ff0000']}, 'FireCCI51', false);
    }
   
  
    // Correct initialization of diff_image adicionando as camadas de pre post e diferencia
    // em uma unica imagem 
    
    band_list.forEach(function(band_name){
        diff_image = diff_image.addBands(pre_image.select(band_name).rename(band_name + '_pre'));
        diff_image = diff_image.addBands(post_image.select(band_name).rename(band_name + '_post'));
        diff_image = diff_image.addBands(post_image.select(band_name).subtract(pre_image.select(band_name))
                                .rename(band_name + '_diff')    
                        );
        lst_band_totrain.push(band_name + '_pre');
        lst_band_totrain.push(band_name + '_post');
        lst_band_totrain.push(band_name + '_diff');
    })
   
}
function process_BA_view() {
    var training = diff_image.sampleRegions({
        collection: burned_tr.merge(unburned_tr),
        properties: ['class'],
        scale: pixelSize
    });

    var param_classifer = {
        numberOfTrees: 500, 
        minLeafPopulation: 10
    }
    var RF_classifier = ee.Classifier.smileRandomForest(param_classifer)
                                .setOutputMode('PROBABILITY')
                                .train(training, 'class', lst_band_totrain)

    // Export.classifier.toAsset(trained);
    classified = diff_image.select(lst_band_totrain).classify(RF_classifier, 'RF');
    
    // selecciona el valor medio de todos os pixels da classificação probabilistica 
    // salva em um número e esse será o limear de fogo 
    thr_seed = ee.Number(classified.reduceRegions({
                        reducer: ee.Reducer.mean(),
                        collection: burned_tr,
                        scale: pixelSize
                    }).aggregate_mean('mean'));
}
function process_BA_download() {
    // separando a camada probabilista em fogo em fogo seed e second 
    var BA_seed = classified.gte(thr_seed);
    var BA_second = classified.gte(0.5);
    
    // 
    var mask = diff_image.select('NIR_diff').mask().eq(0);
    BA_second = BA_second.unmask(0).add(mask.multiply(2));
    BA_seed = BA_seed.unmask(0).add(mask.multiply(2));
    
    
    var BA_vectors = BA_second.addBands(BA_seed)
                    .reduceToVectors({
                            geometry: region.geometry(),
                            crs: projection.crs,
                            crsTransform: projection.transform,
                            geometryType: 'polygon',
                            eightConndate1.slice(0, 8)cted: false,
                            reducer: ee.Reducer.sum(),
                            tileScale: 16,
                            maxPixels: 1e12
                    })
                    .filter(ee.Filter.greaterThanOrEquals('label', 1))
                    .filter(ee.Filter.greaterThanOrEquals('sum', 1));
    
    var studyArea_geometry = studyArea.geometry();
    var dates_vectors = date_image
                            .reduceRegions({
                                collection: BA_vectors,
                                reducer: ee.Reducer.mode(),
                                crs: projection.crs,
                                crsTransform: projection.transform,
                                tileScale: 16
                            }).map(
                                function(feature) {
                                    var date = ee.Number(feature.get('mode')).round().int32();
                                    var label = ee.Number(feature.get('label'));
                                    feature = ee.Feature(ee.Algorithms.If(
                                        label.eq(1),
                                        feature.set('BurnDate', date),
                                        feature.set('BurnDate', ee.Number(0).int32())
                                        ));
                                    return feature;
                                })
                                .filter(ee.Filter.contains({
                                            leftValue: studyArea_geometry, 
                                            rightField:'.geo'})
                                        );
    
    return dates_vectors;
}
function view_BA() {
    process_BA_view();
    var BA_raster = classified;
    var BA_seed = BA_raster.gte(thr_seed);
    BA_seed = BA_seed.updateMask(BA_seed);
    var mask = BA_raster.gte(0.5);
    BA_raster = BA_raster.updateMask(mask);
    
    Map.addLayer(BA_raster, visualize.map_notfire , 'BA');
    Map.addLayer(BA_seed, visualize.map_fire, 'Seeds');
}
function download_BA(exportarDriver) {    
    lst_idCod_reg.evaluate(
        function(lista_idCod_reg){
            lista_idCod_reg.forEach(function(par_idCod){
                var ntile = par_idCod[0];
                var nproject = par_idCod[1]
                var geom_limit = list_regions.filter(ee.Filter.eq('TILE', ntile)).first().geometry();
                var name = nameBase + '_' + date_2 + '_' + date_3 + '_TILE-' + ntile;
                var BA_vectors = process_BA_download();
                export_raster_classified(BA_vectors, name, geom_limit, exportarDriver);
            })
        }

    ) 
}
function download_TIF() {
    lst_idCod_reg.evaluate(
        function(lista_idCod_reg){
            lista_idCod_reg.forEach(function(par_idCod){
                var ntile = par_idCod[0];
                var nproject = par_idCod[1]
                var shp_limit = list_regions.filter(ee.Filter.eq('TILE', ntile));
                var mask_region = shp_limit.reduceToImage(['id_codigo'], ee.Reducer.first());
                var geom_limit = shp_limit.first().geometry();
                var name = nameBase + '_' + date_2 + '_' + date_3 + '_TILE-' + ntile;
                var BA_raster = classified.updateMask(region.geometry()).multiply(100).byte();
                BA_raster = BA_raster.set('system:footprint', geom_limit);
                export_raster_classified(BA_raster, name, geom_limit);
            })
        }

    )
}

function export_prob_mosaic() {
    // Aplica a máscara para filtrar apenas pixels entre 0.5 e 1
    var prob_mosaic = classified.updateMask(classified.gte(0.5).and(classified.lte(1))).updateMask(mask_study_area);    
    // Nome do arquivo
    var name = nameBase + '_' + date_2 + '-' + date_3 + '_MOSAIC';
    Export.image.toDrive({
        image: prob_mosaic,
        description: name + '_Prob',
        folder: '2024_01_Geofogo_Norte1',
        region: studyArea, // ou geometry de interesse
        scale: 20,
        crs: 'EPSG:4326', // ou outro CRS desejado
        maxPixels: 1e13
    });
}

var region;
var nameBase;
var pixelSize;
var projection;
var date_image;
var diff_image;
var classified;
var thr_seed;
///var drive;



// Create a panel with vertical flow layout.
var panel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {width: '250px'}
});

if (studyArea.size().getInfo() === 0) {
    var nlabel = ui.Label('Please define a study area')
    print('Please define a study area');
    panel.add(nlabel);

} else {
    view_data();
    
    var burned_tr = ee.FeatureCollection(burned).filterBounds(studyArea);
    var unburned_tr = ee.FeatureCollection(unburned).filterBounds(studyArea);
    
    if (burned_tr.size().getInfo()===0) {
        var text_print = 'Please define some burned polygon(s)'
        print(text_print);
        var nlabel = ui.Label(text_print);        
        panel.add(nlabel)
    } else if (unburned_tr.size().getInfo()===0) {
        var text_print = 'Please define some unburned polygon(s)'
        print(text_print);
        var nlabel = ui.Label(text_print);
        panel.add(nlabel)
    } else {
        view_BA();
        // adding os wotdget
        var button_zoom = ui.Button({
            label: 'Zoom to region',
            style: {width: '230px'},
            onClick: function() {
                Map.centerObject(studyArea);
            }
        });
        var button_export_BA_drive = ui.Button({
            label: 'Export BA to Google Drive',
            style: {width: '230px'},
            onClick: function() {
                export_drive = true;
                download_BA(false);
            }
        });
        var button_export_BA_asset = ui.Button({
            label: 'Export BA as GEE assets',
            style: {width: '230px'},
            onClick: function() {
                download_BA(false);
            }
        });
        var button_export_TIF = ui.Button({
            label: 'Export probability images',
            style: {width: '230px'},
            onClick: download_TIF()
        });
        var button_export_prob_mosaic = ui.Button({
            label: 'Export Probability Mosaic',
            style: {width: '230px'},
            onClick: export_prob_mosaic()
        });
        var nlabel = ui.Label({
            value: "toolkit Burned area",
             style: {fontSize: '24px',  width: '200px'},
        });
        var img_logo = ee.Image(asset_logo).visualize({ min: 0, max: 255, bands: ['b3', 'b2', 'b1'] });
        var box_img =  img_logo.geometry();
        var thumbnail = ui.Thumbnail({
                                image: img_logo,
                                params: {dimensions: '256x256', region: box_img, format: 'png'},
                                style: {height: '250px', width: '250px'}
                            })
        panel.add(thumbnail)
        panel.add(nlabel)
        panel.add(button_zoom)
        panel.add(button_export_prob_mosaic);
        panel.add(button_export_BA_drive)
        panel.add(button_export_BA_asset)
        panel.add(button_export_TIF)
    }
}


// Add the panel to the ui.root.
ui.root.add(panel);

//focos NOAA20 y SNPP
var noaa_viirs = ee.ImageCollection('NASA/LANCE/NOAA20_VIIRS/C2')
                        .filter(ee.Filter.date(date_2, date_3))
                        .select( ['Bright_ti4']);

//Map.setCenter(-113.2487, 59.3943, 8);
Map.addLayer(noaa_viirs, visualize.map_NOA, 'NOAA');

var suomi_viirs = ee.ImageCollection('NASA/LANCE/SNPP_VIIRS/C2')
                      .filter(ee.Filter.date(date_2, date_3))
                      .select( ['Bright_ti4']);

//Map.setCenter(-113.2487, 59.3943, 8);
Map.addLayer(suomi_viirs, visualize.map_NOA, 'Suomi')

var Geom = ee.FeatureCollection ('projects/dsak-463213/assets/sep_geofogo/SETOR_NORTE_1')
Map.addLayer(Geom, {color: 'blue'}, 'geom')