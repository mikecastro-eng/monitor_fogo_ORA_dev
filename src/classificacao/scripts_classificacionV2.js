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
    index_NBR: {
        min: 1, max: 1600,
        palette: ["#f8f8f4ff","#ffff89","#ffcc50","#ff9800","#c06500","#853400"]
    },
    map_notfire: {min: 0.5, max: 1, palette: ['#ffffff', '#0000ff']},
    map_fire: {min:0, max:1, palette:['#ffffff', '#ff0000']},
    layer_VIIRS: {
        min: 280, max: 400,
        palette: []
    },
    map_SNPP_NOAA:  {
            min: 280.0,  max: 400.0,
            palette: ['#eff30fff', '#e9ac67ff', '#8d360eff','#a11313ff', '#3b0606ff'],
            
    }
};
var param = {
    'asset_grade_1d':  'users/ekhiroteta/BAMT/BAMT_GEE_downloadableTiles_1d',
    'asset_grade_2d': 'users/ekhiroteta/BAMT/BAMT_GEE_downloadableTiles_2d',
    'asset_region_basin' : 'projects/dsak-463213/assets/shps_public/shp_basingroup_fogo_joined',
    // NOAA-20 (JPSS-1) Visible Infrared Imaging Radiometer Suite (VIIRS) Active Fire detection
    'asset_NOAA': 'NASA/LANCE/NOAA20_VIIRS/C2',
    // Suomi NPP Visible Infrared Imaging Radiometer Suite (VIIRS) Active Fire detection product
    'asset_SNPP': 'NASA/LANCE/SNPP_VIIRS/C2' 
}
var dict_analistas = {
    rafaela: [1, 3, 5, 9],
    matias:  [4, 7, 8, 10],
    maria:  [2, 11, 12, 6]  
}
var list_analista = ['maria', 'rafaela', 'matias'];
var analista_activo = '';
var asset_studio = 'projects/dsak-463213/assets/sep_geofogo/SETOR_NORTE';
var asset_logo = 'projects/ee-diegosilvaotca/assets/logo2';
var grade_1d  = ee.FeatureCollection(param.asset_grade_1d);
var grade_2d  = ee.FeatureCollection(param.asset_grade_2d);
var studyArea = ee.FeatureCollection(param.asset_region_basin);

var list_regions_orig = grade_2d.filterBounds(studyArea);
var list_regions = grade_2d.filterBounds(studyArea);
// colocando um metadado para criar mascaras 
list_regions = list_regions.map(function(feat){return feat.set('id_codigo', 1)})
var lst_idCod_reg = list_regions.reduceColumns(ee.Reducer.toList(2), ['TILE', 'PROJ']).get('list');

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

// aplicar o calculo de todos os spectral index]
function apply_spectral_index (image) {  
    var QA_BAND = 'cs_cdf';
    var CLEAR_THRESHOLD = 0.60;
    var mask_image = image.select(QA_BAND).gte(CLEAR_THRESHOLD);
    var raster_masked = image.updateMask(mask_image);
    raster_masked = raster_masked.select(list_bands).rename(list_band_name);
    
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




function get_data_raster(){
    
    // Use 'cs' or 'cs_cdf', depending on your use-case; see docs for guidance.
    var QA_BAND = 'cs_cdf';

    // The threshold for masking; values between 0.50 and 0.65 generally work well.
    // Higher values will remove thin clouds, haze & cirrus shadows.
    var CLEAR_THRESHOLD = 0.60;

    // Cloud Score+ image collection. Note Cloud Score+ is produced from Sentinel-2
    // Level 1C data and can be applied to either L1C or L2A collections.
    var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

    var pre_image = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
                        .filterBounds(studyArea)
                        .filterDate(date_inic, date_inter)
                        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
                        .linkCollection(csPlus, [QA_BAND])
                        .map(function(img) {
                            return img.updateMask(img.select(QA_BAND).gte(CLEAR_THRESHOLD));
                        })
                        //.map(apply_masking_cloud_s2);

    var post_image = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
                        .filterBounds(studyArea)
                        .filterDate(date_inter, date_end)
                        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
                        .linkCollection(csPlus, [QA_BAND])
                        //.map(apply_masking_cloud_s2);

    
    //print("show data pre cloud ", pre_image);
    //print("show data post cloud ", post_image);
    
    // addicionar todas as bandas de indices espectrais  NBR, NBR2, NDVI
    pre_image = pre_image.map(apply_spectral_index);
    post_image = post_image.map(apply_spectral_index);
    
    //print("show data pre", pre_image);
    //print("show data post ", post_image);
    
    post_image = post_image.qualityMosaic('NBR');
    pre_image = pre_image.qualityMosaic('NBR');

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



var mosaico_train = get_data_raster();
print(" conferir todas as bandas do mosaico construido ", mosaico_train);
print("Número de bandas ", mosaico_train.bandNames());

//focos NOAA20 y SNPP
var noaa_viirs = ee.ImageCollection(param.asset_NOAA)
                        .filter(ee.Filter.date(date_inter, date_end))
                        .select( ['Bright_ti4'])
                        .mosaic()
                        .updateMask(mask_study_area);

//Map.setCenter(-113.2487, 59.3943, 8);
Map.addLayer(noaa_viirs, visualize.map_NOA, 'NOAA');

var suomi_viirs = ee.ImageCollection(param.asset_SNPP)
                      .filter(ee.Filter.date(date_inter, date_end))
                      .select( ['Bright_ti4'])
                      .mosaic()
                      .updateMask(mask_study_area);

Map.addLayer(mosaico_train, visualize.mosaico_pre, 'Pre-mosaic');
Map.addLayer(mosaico_train ,  visualize.mosaico_post, 'Post-mosaic');
Map.addLayer(noaa_viirs, visualize.map_SNPP_NOAA, 'NOAA', false);
Map.addLayer(suomi_viirs, visualize.map_SNPP_NOAA, 'Suomi', false);
var bounder = ee.Image().byte().paint({
    featureCollection: shp_basin,
    color: 1,
    width: 2
});
Map.addLayer(bounder, {palette: '#75440c'}, 'Bacias Analises');
Map.centerObject(shp_basin, 4);


// Create a panel with vertical flow layout.
var panel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {width: '250px'}
});

// if (studyArea.size().getInfo() === 0) {
//     var nlabel = ui.Label('Please define a study area')
//     print('Please define a study area');
//     panel.add(nlabel);

// } else {
//     view_data();
    
//     var burned_tr = ee.FeatureCollection(burned).filterBounds(studyArea);
//     var unburned_tr = ee.FeatureCollection(unburned).filterBounds(studyArea);
    
//     if (burned_tr.size().getInfo()===0) {
//         var text_print = 'Please define some burned polygon(s)'
//         print(text_print);
//         var nlabel = ui.Label(text_print);        
//         panel.add(nlabel)
//     } else if (unburned_tr.size().getInfo()===0) {
//         var text_print = 'Please define some unburned polygon(s)'
//         print(text_print);
//         var nlabel = ui.Label(text_print);
//         panel.add(nlabel)
//     } else {
//         view_BA();
        
//     }
// }


// building tookit classify e analises
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
var button_classificar = ui.Button({
    label: 'Gerar classificação',
    style: {width: '230px'},
    onClick: function() {
        download_BA(false);
    }
});
var button_export_class = ui.Button({
    label: 'Export classificação',
    style: {width: '230px'},
    // onClick: download_TIF()
});
var button_export_prob_mosaic = ui.Button({
    label: 'Export Probability Mosaic',
    style: {width: '230px'},
    //onClick: export_prob_mosaic()
});
var nlabel_titulo = ui.Label({
    value: "Toolkit Burned area",
    style: {
            fontSize: '20px',  
            width: '200px'
        },
});
var nlabel_subtil1 = ui.Label({
    value: "Lista de analistas",
    style: {
            fontSize: '16px',  
            width: '200px'
        },
})
var img_logo = ee.Image(asset_logo).visualize({ min: 0, max: 255, bands: ['b3', 'b2', 'b1'] });
var box_img =  img_logo.geometry();
var thumbnail = ui.Thumbnail({
                        image: img_logo,
                        params: {dimensions: '256x256', region: box_img, format: 'png'},
                        style: {height: '120px', width: '220px'}
                    })

var checkbox_maria = ui.Checkbox('Analista Maria', false); 
var checkbox_rafaela = ui.Checkbox('Analista Rafaela', false);
var checkbox_matias= ui.Checkbox('Analista Matias', false);
//list_analista = ['maria', 'rafaela', 'matias'];
if (checkbox_maria.getValue()){
    analista_activo = 'maria';
}else{
    if (checkbox_rafaela.getValue()){
        analista_activo = 'rafaela';
    }else{
        if (checkbox_rafaela.getValue()){
            analista_activo = 'matias'
        }
    }
}


panel.add(thumbnail);
panel.add(nlabel_titulo);
panel.add(nlabel_subtil1);
panel.add(checkbox_maria);
panel.add(checkbox_rafaela);
panel.add(checkbox_matias);
// panel.add(button_zoom);
//panel.add(button_export_prob_mosaic);
//panel.add(button_export_BA_drive)
panel.add(button_classificar);
panel.add(button_export_class);


// Add the panel to the ui.root.
ui.root.add(panel);

// //focos NOAA20 y SNPP
// var noaa_viirs = ee.ImageCollection('NASA/LANCE/NOAA20_VIIRS/C2')
//                         .filter(ee.Filter.date(date_2, date_3))
//                         .select( ['Bright_ti4']);

// //Map.setCenter(-113.2487, 59.3943, 8);
// Map.addLayer(noaa_viirs, visualize.map_NOA, 'NOAA');

// var suomi_viirs = ee.ImageCollection('NASA/LANCE/SNPP_VIIRS/C2')
//                       .filter(ee.Filter.date(date_2, date_3))
//                       .select( ['Bright_ti4']);

//Map.setCenter(-113.2487, 59.3943, 8);
// Map.addLayer(suomi_viirs, visualize.map_NOA, 'Suomi')

// var Geom = ee.FeatureCollection ('projects/dsak-463213/assets/sep_geofogo/SETOR_NORTE_1')
// Map.addLayer(Geom, {color: 'blue'}, 'geom')