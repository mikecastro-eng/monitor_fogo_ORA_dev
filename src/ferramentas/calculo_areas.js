var param = {
    'asset_grade_1d':  'users/ekhiroteta/BAMT/BAMT_GEE_downloadableTiles_1d',
    'asset_grade_2d': 'users/ekhiroteta/BAMT/BAMT_GEE_downloadableTiles_2d',
    'asset_region_basin' : 'projects/dsak-463213/assets/shps_public/shp_basingroup_fogo_joined',
    'asset_layer_fire':  "projects/maycon-castro/assets/layers_fire_ora",
    // NOAA-20 (JPSS-1) Visible Infrared Imaging Radiometer Suite (VIIRS) Active Fire detection
    'asset_NOAA': 'NASA/LANCE/NOAA20_VIIRS/C2',
    // Suomi NPP Visible Infrared Imaging Radiometer Suite (VIIRS) Active Fire detection product
    'asset_SNPP': 'NASA/LANCE/SNPP_VIIRS/C2' 
};

function calculateArea (image, feat_limit){
    Map.addLayer(feat_limit, {color: 'black'}, 'região');
    Map.addLayer(image.selfMask(), {min:0, max: 1, palette: 'FF0000'}, 'fire');
    var mask_reg = ee.FeatureCollection(feat_limit)
                        .reduceToImage(['id_code'], ee.Reducer.first()).eq(1);
    // areas em hectares    
    var pixelArea = ee.Image.pixelArea().divide(10000).updateMask(mask_reg);
    pixelArea = pixelArea.addBands(image.select([0]).rename('classe').selfMask());
    
    var reducer = ee.Reducer.sum().group(1, 'classe');
    var optRed = {
        'reducer': reducer,
        'geometry': feat_limit.geometry(),
        'scale': 30,
        'bestEffort': true, 
        'maxPixels': 1e13
    };    
    var areas = pixelArea.reduceRegion(optRed);
    print(areas)
    areas = ee.List(areas.get('groups')).map(
                                function(item) { 
                                    return convert2featCollection(item);
                                });
    areas = ee.FeatureCollection(areas); 
    return areas;
}
function convert2featCollection (item){
    item = ee.Dictionary(item);
    var feature = ee.Feature(ee.Geometry.Point([0, 0])).set(
        'classe', item.get('classe'), "area", item.get('sum'));
    return feature;
}
//exporta a imagem classificada para o asset
function processoExportar(areaFeat, nameT){      
    var optExp = {
          'collection': ee.FeatureCollection(areaFeat), 
          'description': nameT, 
          'folder': "area_queimada"        
        };    
    Export.table.toDrive(optExp) ;
    print(" salvando ... " + nameT + "..!")      ;
}


// aqui novas mudanças 

var dict_projects = {
    rafaela: 'rafaela-cipriano',
    matias: 'dsak-463213',
    maria: '',
    maycon: 'ee-diegosilvaotca'
};
var lst_analistas = ['rafaela', 'matias', 'maycon'];
var dict_analistas = {
    rafaela: ['1', '3', '5', '9'],
    matias:  ['4', '7', '8', '10'],
    maria:  ['2', '11', '12', '6'],
    maycon: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
};
var analista_activo = '';
var npath_asset = '';
// load sho região 
var regioes_amaz = ee.FeatureCollection(param.asset_region_basin);
regioes_amaz = regioes_amaz.map(function(feat){return feat.set('id_code', 1)});
print("show metadata regiões amazonicas ", regioes_amaz);
// Load all image Collection in fire 
var layer_fire = ee.ImageCollection([]);
lst_analistas.forEach(
    function(analista_act){
        npath_asset = "projects/" + dict_projects[analista_act] + "/assets/layers_fire_ora";
        print("id-asset >> " + npath_asset);
        layer_fire = layer_fire.merge(ee.ImageCollection(npath_asset));       

    }
);
layer_fire = layer_fire.map(
  function(img){
    var idCod = img.get('system:index');
    var partes = ee.String(idCod).split("_");
    var rregion = ee.List(partes).get(ee.Number(ee.List(partes).length()).subtract(1));
    var ppartes = ee.List(partes).get(ee.Number(ee.List(partes).length()).subtract(3));
    ppartes = ee.String(ppartes).split("-");
    var nmonth = ee.List(ppartes).get(1);
    var nyear = ee.List(ppartes).get(0);
    return img.set(
              'region', rregion, 
              'month', ee.Number.parse(nmonth),
              'year', ee.Number.parse(nyear)
            );
})
print("----------------------------------------");
print("Loaded maps size ", layer_fire.size());
print(layer_fire);
print("----------------------------------------");
var mmonth = 1;
var yyear = 2024;
var all_areas = ee.FeatureCollection([]);
// var lst_regions = [1,2,3,4,5,6,7,8,9,10,11,12];
var lst_regions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
lst_regions.forEach(function(nregion){
    print('processing region ' + nregion);
    var feat_region = regioes_amaz.filter(ee.Filter.eq('id_code_group', nregion));
    print("feat region selected ", feat_region.size());
    var area_region = feat_region.first().geometry().area().divide(10000);
    print("area região em hectare ", area_region);
    var raster_fire = layer_fire.filter(ee.Filter.eq('region', nregion))
                                .filter(ee.Filter.eq('year', yyear))
                                .filter(ee.Filter.eq('month', mmonth));
    var size_ic = raster_fire.size().getInfo();               
    print("tamanho do image Collection ", size_ic);

    var dict_prop = {
                  'region': nregion,
                  'year': yyear,
                  'month': mmonth,
                  'area_region': area_region
            };
    var feat_area = ee.FeatureCollection(
                              ee.Feature(ee.Geometry.Point([0, 0]),dict_prop).set('area', 0));
    if (size_ic === 1){
        feat_area = calculateArea(ee.Image(raster_fire.first()), feat_region);
        feat_area = feat_area.select('area').map(
                          function(feat){ return feat.set(dict_prop)});
                    }
    print("show área ", feat_area);
    all_areas = all_areas.merge(feat_area);
});

var name_exp = 'areas_' + String(yyear) + "_" + String(mmonth);
processoExportar(all_areas, name_exp);


