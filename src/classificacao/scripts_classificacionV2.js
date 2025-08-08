var visualize = {
    mosaico_pre: {
        min: [0, 1000, 0], 
        max: [3000, 4000, 3000],
        bands: ['SWIR2_pre', 'NIR_pre', 'Red_pre']
    },
    mosaico_post: {
        min: [0, 1000, 0], 
        max: [3000, 4000, 3000],
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
    maria:  [2, 11, 12, 6],
    maycon: [1,2,3,4,5,6,7,8,9,10,11,12]
}
var dict_projects = {
    rafaela: 'rafaela-cipriano',
    matias: 'dsak-463213',
    maria: '',
    maycon: 'maycon-castro'
}
// var list_analista = ['maria', 'rafaela', 'matias'];
var analista_activo = 'rafaela';
var region = '';
var shp_basin = ee.FeatureCollection(param.asset_region_basin);
shp_basin = shp_basin.map(function(feat){return feat.set('id_code', 1)});
//print(shp_basin)
var studyAreastudyArea = shp_basin.filter(ee.Filter.eq('id_code_group', region));
print("show geometry of área de estudo ", studyArea);
var year_activo = 2024;
var month_activo = 1;
var date_inter = ee.Date.fromYMD(year_activo, month_activo, 1); 
var date_inic = date_inter.advance(-2, 'month');  
var date_end = date_inter.advance(1, 'month');  
var list_bands = ['B2', 'B3', 'B4', 'B8A', 'B11', 'B12'];
var list_band_name = ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2'];
var band_list = ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2', 'NBR2', 'NBR', 'NDVI'];
var lst_band_totrain = ee.List([]);
var samples_loaded = false;
var show_fireCCI_MODI = false;
var export_drive = true;
var diff_image = ee.Image().toUint16();
var mapa_area_queimada = null;
var raster_classificado = false;
      
//Map.centerObject(studyArea,10);
// vamos convertir la área de estudo em uma mascara para sustituir la función clip por updateMask
var mask_study_area = studyArea.reduceToImage(['id_code'], ee.Reducer.first());


function export_raster_classified(raster_fire, name_export, export_to_drive){
    var id_asset_exp = "projects/" + dict_projects[analista_activo] + "/assets/layers_fire_ora/" + name_export;
    var param_export = null;
    if (export_to_drive) {
        param_export = {
            image: raster_fire,
            description: name_export,
            folder: '2024_01_Geofogo_Norte1',
            region: studyArea, // ou geometry de interesse
            scale: 30,
            crs: 'EPSG:4326', // ou outro CRS desejado
            maxPixels: 1e13
        }
        Export.image.toDrive(param_export);
    }else{
        param_export = {
            image: raster_fire, 
            description: name_export, 
            assetId: id_asset_exp, 
            region: studyArea, 
            scale: 30, 
            crs: 'EPSG:4326',
            maxPixels: 1e13, 
        }
        Export.image.toAsset(param_export);
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

    studyArea = shp_basin.filter(ee.Filter.eq('id_code_group', region));
    print("show geometry of área de estudo ", studyArea);
    mask_study_area = studyArea.reduceToImage(['id_code'], ee.Reducer.first());
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

    var post_image = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
                        .filterBounds(studyArea)
                        .filterDate(date_inter, date_end)
                        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
                        .linkCollection(csPlus, [QA_BAND])

    // addicionar todas as bandas de indices espectrais  NBR, NBR2, NDVI
    pre_image = pre_image.map(apply_spectral_index);
    post_image = post_image.map(apply_spectral_index);
    
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
        // print("processing banda " + band_name);
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


var list_regions = [];
var mosaico_train = null;
//focos NOAA20 y SNPP
var noaa_viirs = null;
var suomi_viirs = null;
var samples_rois_month = null;

Map.setOptions("TERRAIN" );
var bounder = ee.Image().byte().paint({
    featureCollection: shp_basin,
    color: 1,
    width: 2
});
Map.addLayer(bounder, {palette: '#75440c'}, 'Bacias Analises');
Map.centerObject(shp_basin, 4);

function loading_images_zoom(load_imag){
    print("variavel load data " + load_imag);
    if (load_imag === true){
        mosaico_train = get_data_raster();
        print(" conferir todas as bandas do mosaico construido ", mosaico_train);
        print("Número de bandas ", mosaico_train.bandNames());

        //focos NOAA20 y SNPP
        var noaa_viirs = ee.ImageCollection(param.asset_NOAA)
                                .filter(ee.Filter.date(date_inter, date_end))
                                .select( ['Bright_ti4'])
                                .mosaic()
                                .updateMask(mask_study_area);

        var suomi_viirs = ee.ImageCollection(param.asset_SNPP)
                            .filter(ee.Filter.date(date_inter, date_end))
                            .select( ['Bright_ti4'])
                            .mosaic()
                            .updateMask(mask_study_area);
        Map.addLayer(mosaico_train, visualize.mosaico_pre, 'Pre-mosaic');
        Map.addLayer(mosaico_train ,  visualize.mosaico_post, 'Post-mosaic');
        Map.addLayer(noaa_viirs, visualize.map_SNPP_NOAA, 'NOAA', false);
        Map.addLayer(suomi_viirs, visualize.map_SNPP_NOAA, 'Suomi', false);
        Map.centerObject(studyArea, 6);
    }
}

function loading_samples(){
    // projects/rafaela-cipriano/assets/samples/sample_2024-01-01_2024-01-31_region_9
    var date1 = date_inter.format("YYYY-MM-DD").getInfo();    
    var asset_id = "projects/" + dict_projects[analista_activo] + 
                "/assets/samples/sample_" + date1 +
                "_" + date1.slice(0, 8) + "31_region_" + region;
    print("asset >> ", asset_id);
    samples_rois_month = ee.FeatureCollection(asset_id);
    print("show rois ", samples_rois_month.aggregate_histogram('class'));
    samples_loaded = true;
    Map.addLayer(samples_rois_month, {}, 'ROIs');
}

function make_classification(){

    var lst_band_totrain = [
                    'NBR_post', 'NBR2_post', 'NIR_post', 'NBR_diff', 'NDVI_post', 'NBR2_diff', 
                    'NDVI_diff', 'SWIR2_diff', 'SWIR2_post', 'NIR_diff', 'Red_post', 'SWIR1_diff', 
                    'SWIR1_post', 'Blue_pre'
                ];
    print(" as variavveis seram ", lst_band_totrain);
    var param_classifer = {
        numberOfTrees: 500, 
        minLeafPopulation: 10
    }
    var RF_classifier = ee.Classifier.smileRandomForest(param_classifer)
                                .setOutputMode('PROBABILITY')
                                .train(samples_rois_month, 'class', lst_band_totrain)

    // Export.classifier.toAsset(trained);
    var classified = mosaico_train.select(lst_band_totrain).classify(RF_classifier, 'RF');
    mapa_area_queimada = classified.gte(0.5);
    Map.addLayer(mapa_area_queimada.selfMask(), visualize.map_fire, 'mapa queimadas');
    raster_classificado = true
}

function make_export_raster(){
    print("exporting fire layer " );
    var date1 = date_inter.format("YYYY-MM-DD").getInfo();
    var name_export = "layer_fire_" + date1.slice(0, 7) + "_reg_" + region;
    mapa_area_queimada = mapa_area_queimada.set({
                                            'month': month_activo,
                                            'years': year_activo,
                                            'region': region,
                                            'system:footprint': studyArea
                                });
    export_raster_classified(mapa_area_queimada.selfMask(), name_export, false);
}


// Create a panel with vertical flow layout.
var panel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {width: '250px', stretch: 'horizontal'}
});

// building tookit classify e analises
// adding os wotdget
var button_loader = ui.Button({
    label: 'ler amostras',
    style: {width: '230px'},
    onClick: function() {
        if (region !== ''){ 
            loading_samples();
        }
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
        if (region !== ''){ 
            if (samples_loaded === false){
                loading_samples();
                samples_loaded = true;
            }
            make_classification();
        }
    }
});
var button_export_class = ui.Button({
    label: 'Export classificação',
    style: {width: '230px'},
    onClick: function(){
        if (raster_classificado === true){
            make_export_raster()
        }
    }
});
var button_make_zoom = ui.Button({
    label: 'zoom região',
    style: {width: '230px'},
    onClick: function(){
      if (region !== ''){ 
          print("valor de onclick do button em true" )
          loading_images_zoom(true);
      }
      

    }
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

var month_select_start= ui.Select({ 
        items: [
            { label: "janeiro", value: 1 },
            { label: "fevereiro", value: 2},
            { label: "março", value: 3},
            { label: "abril", value: 4},
            { label: "maio", value: 5},
            { label: "junho", value: 6},
            { label: "julho", value: 7},
            { label: "agosto", value: 8},
            { label: "setembro", value: 9},
            { label: "outubro", value: 10},
            { label: "novembro", value: 11},
            { label: "dezembro", value: 12},
        ],
        placeholder: 'seleciona um mês',
        value: 1,
        style: {margin: '2px 2px', width: '120px'},
        onChange: function(value){                  
            month_activo = value;
            date_inter = ee.Date.fromYMD(year_activo, month_activo, 1); 
            date_inic = date_inter.advance(-2, 'month');  
            date_end = date_inter.advance(1, 'month'); 
            print("date inicial de analises ", date_inter);
            print("date final de analises ", date_end);
        }
    })

var img_logo = ee.Image(asset_logo).visualize({ min: 0, max: 255, bands: ['b3', 'b2', 'b1'] });
var box_img =  img_logo.geometry();
var thumbnail = ui.Thumbnail({
                        image: img_logo,
                        params: {dimensions: '256x256', region: box_img, format: 'png'},
                        style: {height: '120px', width: '220px'}
                    })



var select_regiao = ui.Select({
    items: Object.keys(list_regions),
    placeholder: 'Região',
    style: {margin: '2px 2px', width: '120px'},
    onChange: function(key) {
        region = String(key);
        print("região selecionada ", region);
    }
});

var checkbox_maria = ui.Checkbox({
    label: 'Analista Maria', 
    value: false,
    style: {margin: '10px 5px'},
    onChange: function(){
        analista_activo = 'maria';
        list_regions = [];
        print("lista de regions ", list_regions);        
        dict_analistas.maria.forEach(
            function(item){
                list_regions.push({label: 'região_' + item, value: item});                
            }
        )
        // Asynchronously get the list of band names.
        select_regiao.items().reset(dict_region); 
        select_regiao.setPlaceholder('Selecione uma região');
    }
}); 
var checkbox_rafaela = ui.Checkbox({
    label: 'Analista Rafaela', 
    value: false,
    style: {margin: '10px 5px'},
    onChange: function(){
        analista_activo = 'rafaela';
        print("analista activos = " + analista_activo)
        list_regions = [];
        dict_analistas.rafaela.forEach(
            function(item){
                list_regions.push({label: 'região_' + item, value: item});
            }
        )
        // Asynchronously get the list of band names.
        select_regiao.items().reset(list_regions);    
        select_regiao.setPlaceholder('Selecione uma região');    
    }
});
var checkbox_matias= ui.Checkbox({
    label: 'Analista Matias',
    value: false,
    style: {margin: '10px 5px'},
    onChange: function(){
        analista_activo = 'matias';
        list_regions = [];
        dict_analistas.matias.forEach(
            function(item){
                list_regions.push({label: 'região_' + item, value: item});
            }
        )
        // Asynchronously get the list of band names.
        select_regiao.items().reset(list_regions); 
        select_regiao.setPlaceholder('Selecione uma região');
    }
});
var checkbox_maycon= ui.Checkbox({
    label: 'Analista Maycon',
    value: false,
    style: {margin: '10px 5px'},
    onChange: function(){
        analista_activo = 'maycon';
        list_regions = [];
        dict_analistas.maycon.forEach(
            function(item){
                list_regions.push({label: 'região_' + item, value: item});
            }
        )
        // Asynchronously get the list of band names.
        select_regiao.items().reset(list_regions); 
        select_regiao.setPlaceholder('Selecione uma região');
    }
});
//list_analista = ['maria', 'rafaela', 'matias'];

var panel_select= ui.Panel({
    widgets: [
      select_regiao, // O seletor de região 
      month_select_start  // O seletor de mês aparecerá abaixo
  ],
  // Define o layout como um fluxo vertical.
  layout: ui.Panel.Layout.flow('horizontal'),
})

var nlabel_subtil2 = ui.Label({
    value: "Carrega os mosaicos",     // + region
    style: {
            fontSize: '12px',  
            width: '200px'
        },
})
var nlabel_subtil3 = ui.Label({
    value: "Carrega as amostras" ,  // + region
    style: {
            fontSize: '12px',  
            width: '200px'
        },
})
var nlabel_subtil4 = ui.Label({
    value: "Fazer a Classificação e mostrar",
    style: {
            fontSize: '12px',  
            width: '200px'
        },
})
var nlabel_subtil5 = ui.Label({
    value: "Exportar Classificação",
    style: {
            fontSize: '12px',  
            width: '200px'
        },
})
panel.add(thumbnail);
panel.add(nlabel_titulo);Fluxograma de trabalho para o mapeamento de áreas queimadas
panel.add(button_make_zoom);
panel.add(nlabel_subtil3);
panel.add(button_loader);
panel.add(nlabel_subtil4);
panel.add(button_classificar);
panel.add(nlabel_subtil5);
panel.add(button_export_class);

ui.root.add(panel);
