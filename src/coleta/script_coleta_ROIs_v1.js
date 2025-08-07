var visualize = {
    mosaico_pre: {
        min: 50, 
        max: 4000,
        bands: ['SWIR2_pre', 'NIR_pre', 'Red_pre']
    },
    mosaico_post: {
        min: 50, 
        max: 4000,
        bands: ['SWIR2_post', 'NIR_post', 'Red_post']
    },
    mosaico_dif: {
        min: 0, 
        max: 200,
        bands: ['SWIR2_diff', 'NIR_diff', 'Red_diff']
    },
    map_notfire: {min: 0.5, max: 1, palette: ['#ffffff', '#0000ff']},
    map_fire: {min:0, max:1, palette:['#ffffff', '#ff0000']},
    map_NOA:  {
            min: 280.0,            max: 400.0,
            palette: ['yellow', 'orange', 'red', 'white', 'darkred'],
        }
};

var param = {
    'asset_grade_1d':  'users/ekhiroteta/BAMT/BAMT_GEE_downloadableTiles_1d',
    'asset_grade_2d': 'users/ekhiroteta/BAMT/BAMT_GEE_downloadableTiles_2d',
    'asset_region_basin' : 'projects/dsak-463213/assets/shps_public/shp_basingroup_fogo_joined',
    'asset_region_basin' : 'projects/dsak-463213/assets/shps_public/shp_basingroup_fogo_joined',
}
var dict_analistas = {
    rafaela: [1, 3, 5, 9],
    matias:  [4, 7, 8, 10],
    maria:  [2, 11, 12, 6]  
}
var list_analista = ['maria', 'rafaela', 'matias'];
var analista_activo = 'rafaela';
var region = '5';
var shp_basin = ee.FeatureCollection(param.asset_region_basin);
//print(shp_basin)
var studyArea = shp_basin.filter(ee.Filter.eq('id_code_group', region));
print("show geometry of área de estudo ", studyArea);

var date_inic = '2023-10-01';  
var date_inter = '2024-01-01'; 
var date_end = '2024-01-31';  
var list_bands = ['B2', 'B3', 'B4', 'B8A', 'B11', 'B12'];
var list_band_name = ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2'];
var band_list = ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2', 'NBR2', 'NBR', 'NDVI'];
var lst_band_totrain = ee.List([]);

// vamos convertir la área de estudo em uma mascara para sustituir la función clip por updateMask
studyArea = studyArea.map(function(feat){return feat.set('id_code', 1)});
var mask_study_area = studyArea.reduceToImage(['id_code'], ee.Reducer.first());

// aplicar o calculo de todos os spectral index]
function apply_spectral_index (image) {  
    
    var raster_masked = maskImage(image);

    //  Índice de Queima Normalizado (NBR)
    var nbr2 = raster_masked.normalizedDifference(['SWIR2', 'SWIR1']).rename(['NBR2']);
    nbr2 = nbr2.add(1).multiply(1000).toInt16();
    //  Índice de Queima Normalizado (NBR)
    var nbr = raster_masked.normalizedDifference(['SWIR2', 'NIR']).rename(['NBR']);
    nbr = nbr.add(1).multiply(1000).toInt16();
    // NDVI (Normalized Difference Vegetation Index)
    var ndvi = raster_masked.normalizedDifference(['NIR', 'Red']).rename(['NDVI']);
    ndvi = ndvi.add(1).multiply(1000).toInt16();
    
    return raster_masked.addBands([nbr2, nbr, ndvi])
                //.addBands(dates.rename('dates'));
}
function apply_masking_cloud_s2(image) {
    var date = ee.Number.parse(ee.Date(image.get('system:time_start')).format('yyyyMMdd'));
    // Crear la máscara de nubes usando umbrales para las bandas seleccionadas
    var mask =  image.select('B2').gt(2000) // Umbral para la banda azul (B2)
                        .or(image.select('B11').gt(3000)) // Umbral para la banda infrarroja de onda corta (B11)
                        .or(image.select('B12').gt(3000)); // Umbral para la banda infrarroja de onda corta (B12)
    
    // Seleccionar las bandas deseadas y renombrarlas
    image = image.select(list_bands).rename(list_band_name);
    return image.updateMask(mask_study_area).updateMask(mask.not()).set('date', date);
};


// Join two collections on their 'system:index' property.
// The propertyName parameter is the name of the property
// that references the joined image.
function indexJoin(collectionA, collectionB, propertyName) {
    var joined = ee.ImageCollection(ee.Join.saveFirst(propertyName).apply({
        primary: collectionA,
        secondary: collectionB,
        condition: ee.Filter.equals({
        leftField: 'system:index',
        rightField: 'system:index'})
    }));
    // Merge the bands of the joined image.
    return joined.map(function(image) {
        return image.addBands(ee.Image(image.get(propertyName)));
    });
}

// Aggressively mask clouds and shadows.
function maskImage(image) {
    // Compute the cloud displacement index from the L1C bands.
    var cdi = ee.Algorithms.Sentinel2.CDI(image);
    var s2c = image.select('probability');
    var cirrus = image.select('B10').multiply(0.0001);

    // Assume low-to-mid atmospheric clouds to be pixels where probability
    // is greater than 65%, and CDI is less than -0.5. For higher atmosphere
    // cirrus clouds, assume the cirrus band is greater than 0.01.
    // The final cloud mask is one or both of these conditions.
    var isCloud = s2c.gt(65).and(cdi.lt(-0.5)).or(cirrus.gt(0.01));

    // Reproject is required to perform spatial operations at 20m scale.
    // 20m scale is for speed, and assumes clouds don't require 10m precision.
    isCloud = isCloud.focal_min(3).focal_max(16);
    isCloud = isCloud.reproject({crs: cdi.projection(), scale: 20});

    // Project shadows from clouds we found in the last step. This assumes we're working in
    // a UTM projection.
    var shadowAzimuth = ee.Number(90)
        .subtract(ee.Number(image.get('MEAN_SOLAR_AZIMUTH_ANGLE')));

    // With the following reproject, the shadows are projected 5km.
    isCloud = isCloud.directionalDistanceTransform(shadowAzimuth, 50);
    isCloud = isCloud.reproject({crs: cdi.projection(), scale: 100});

    isCloud = isCloud.select('distance').mask();
    image = image.select(list_bands).rename(list_band_name)
    return image.updateMask(mask_study_area).updateMask(isCloud.not());
}

function get_data_raster(){

    var raster_cloud_pre = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY')
                        .filterBounds(studyArea)
                        .filterDate(date_inic, date_inter)

    var pre_image = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
                        .filterBounds(studyArea)
                        .filterDate(date_inic, date_inter)
                        
                        //.map(apply_masking_cloud_s2);
                        
    var raster_cloud_post = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY')
                        .filterBounds(studyArea)
                        .filterDate(date_inter, date_end)

    var post_image = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
                        .filterBounds(studyArea)
                        .filterDate(date_inter, date_end)
                        //.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
                        //.map(apply_masking_cloud_s2);

    // Join the cloud probability dataset to surface reflectance.
    var raster_pre_CloudProb = indexJoin(pre_image, raster_cloud_pre, 'cloud_probability');
    var raster_post_CloudProb = indexJoin(post_image, raster_cloud_post, 'cloud_probability');
    
    raster_pre_CloudProb = raster_pre_CloudProb.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70));
    raster_post_CloudProb = raster_post_CloudProb.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70));
    
    //print("show data pre cloud ", raster_pre_CloudProb);
    //print("show data post cloud ", raster_post_CloudProb);
    
    // addicionar todas as bandas de indices espectrais  NBR, NBR2, NDVI
    pre_image = raster_pre_CloudProb.map(apply_spectral_index);
    post_image = raster_post_CloudProb.map(apply_spectral_index);
    
    //print("show data pre", pre_image);
    //print("show data post ", post_image);
    
    post_image = post_image.qualityMosaic('NBR');
    pre_image = pre_image.qualityMosaic('NBR');
    
    //Map.addLayer(pre_image, {}, 'show pre')
    //Map.addLayer(post_image, {}, 'show post')
    // get lista de bandas com o sufixo pre e post 
    var lst_bnd_pre = ee.List(band_list).map(function(bnd){return ee.String(bnd).cat('_pre')});
    var lst_bnd_post = ee.List(band_list).map(function(bnd){return ee.String(bnd).cat('_post')})
    
    // change variavel
    pre_image = pre_image.rename(lst_bnd_pre);
    //print("confere dados do mosaico pre", pre_image);
    post_image = post_image.rename(lst_bnd_post);
    //print("confere dados do mosaico post", post_image);

    // make imagem de diferenção 
    var diff_image = ee.Image().toInt16();
    band_list.forEach(function(band_name){ 
        print("processing banda " + band_name);
        diff_image = diff_image.addBands(post_image.select(band_name + "_post")
                            .subtract(pre_image.select(band_name + "_pre"))
                                    .rename(band_name + '_diff')    
                        );
        lst_band_totrain = lst_band_totrain.add(band_name + '_diff');
    });
    // selecionando as bandas com diferencias 
    diff_image = diff_image.select(lst_band_totrain);
    // addicionando as imagens pre e post 
    diff_image = diff_image.addBands(pre_image).addBands(post_image);
    print(" conferir todas as bandas do mosaico ", diff_image);
    
    lst_band_totrain = lst_band_totrain.cat(lst_bnd_pre).cat(lst_bnd_post);
    print("conferir a lista de todas as bandas ", lst_band_totrain);
    return diff_image.updateMask(mask_study_area);
}

function export_table(featSHP, name_exp){

    var id_asset =  'projects/dsak-463213/assets/samples';
    var param_exp = {
        collection: featSHP, 
        description: name_exp, 
        assetId: id_asset + '/' + name_exp, 
        maxVertices: 1e13
    };
    Export.table.toAsset(param_exp);

    param_exp = {
        collection: featSHP, 
        description: name_exp, 
        folder: "samples_fire", 
        maxVertices: 1e13
    };
    Export.table.toDrive(param_exp);
    print('exporting to Asset and to Drive >>>>> ', name_exp);
}


var mosaico_train = get_data_raster();
print(" conferir todas as bandas do mosaico construido ", mosaico_train);
print("Número de bandas ", mosaico_train.bandNames());

Map.addLayer(mosaico_train, visualize.mosaico_pre, 'Pre-fire');
Map.addLayer(mosaico_train ,  visualize.mosaico_post, 'Post-fire');
Map.addLayer(mosaico_train, visualize.mosaico_dif, 'raster-Dif', false);
var bounder = ee.Image().byte().paint({
  featureCollection: studyArea,
  color: 1,
  width: 1.5
});
Map.addLayer(bounder, {palette: '#75440c'}, 'region Coleta');

// processing of samples
var polygon_rois = ee.FeatureCollection(burned.merge(unburned));
var prop_samples = {
    collection: polygon_rois, 
    properties: ['class'], 
    scale: 30, 
    geometries: true
}
var samples_rois = mosaico_train.sampleRegions(prop_samples);
print("show número de rois ", samples_rois.size());

var name_export = 'sample_' + date_inter + "_" + date_end + '_region_' + region;
export_table(samples_rois, name_export);