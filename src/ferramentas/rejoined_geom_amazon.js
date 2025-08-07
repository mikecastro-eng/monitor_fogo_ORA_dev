function export_table(featSHP, name_exp){
    var id_asset =  'projects/dsak-463213/assets/shps_public';
    var param_exp = {
        collection: featSHP, 
        description: name_exp, 
        assetId: id_asset + '/' + name_exp, 
        maxVertices: 1e13
    }
    Export.table.toAsset(param_exp);
    print('exporting >>>>> ', name_exp);
}

var param = {
    'asset_recort_amaz': 'projects/dsak-463213/assets/shps_public/sep_geofogo_joined',
    'asset_bacias_amaz': 'projects/ee-diegosilvaotca/assets/projeto_queimadas/BACIA_RECORT_LIM_RAISG',
    'asset_estados_raisg': 'projects/ee-diegosilvaotca/assets/projeto_queimadas/raisg_boundaries_amazon'
};

var feat_bacias = ee.FeatureCollection(param.asset_bacias_amaz);
print(" show size features ", feat_bacias.size());
var feat_recort = ee.FeatureCollection(param.asset_recort_amaz);
var feat_raisg = ee.FeatureCollection(param.asset_estados_raisg);
print("show size features raisg ", feat_raisg.size());
var feat_bacias_exc = feat_bacias.filter(ee.Filter.neq('PFAF_ID', 6229));
var feat_bacia_toDiv = feat_bacias.filter(ee.Filter.eq('PFAF_ID', 6229));

var feat_boundRaisg = feat_raisg.filter(ee.Filter.eq('ADM1CD_c', 'BRA004'));
var shpdiv_part1 = feat_bacia_toDiv.geometry().intersection(feat_boundRaisg.geometry());
var shpdiv_part2 = feat_bacia_toDiv.geometry().difference(feat_boundRaisg.geometry());

var group_raisg = feat_raisg.filterBounds(other).union();
var shpdiv_part2A = shpdiv_part2.intersection(group_raisg.geometry());
var shpdiv_part2B = shpdiv_part2.difference(group_raisg.geometry());

Map.addLayer(ee.Image.constant(1), {min:0, max: 1}, 'base');
Map.addLayer(feat_boundRaisg, {color : '#0c2a75'}, 'boundRaisg', false);
Map.addLayer(shpdiv_part1, {color : '#696e0a'}, 'interset Bacias part 1');
Map.addLayer(shpdiv_part2A, {color : '#d4221cff'}, 'interset Bacias part 2A');
Map.addLayer(shpdiv_part2B, {color : '#bd7829ff'}, 'interset Bacias part 2B');
//Map.addLayer(group_raisg)


Map.addLayer(feat_bacias_exc, {color: '#186318ff'}, 'bacias Am');
var outline = ee.Image().byte().paint({
  featureCollection: feat_recort,
  color: 1,
  width: 1.5
});
Map.addLayer(outline, {palette: '#FF0000'}, 'recortes Am', false);


var bounder = ee.Image().byte().paint({
  featureCollection: feat_raisg,
  color: 1,
  width: 1.5
});
Map.addLayer(bounder, {palette: '#75440c'}, 'bound Raisg', false);


var dict_analistas = {
    rafaela: [g1, g3, g5, g9],
    matias:  [g4, g7, g8, g10],
    xxxxxx:  [g2, g11, g12, g6]  
}

var list_regions = ee.List([]);
// adding group # 1
var feat_reg_tmp = ee.Feature(shpdiv_part2A, {'id_code_group': '1', 'analista': 'rafaela'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)
// adding group # 2
var featFiltered = feat_bacias.filterBounds(g2).union().geometry();
var feat_reg_tmp = ee.Feature(featFiltered, {'id_code_group': '2', 'analista': 'maria'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)
// adding group # 3
var feat_reg_tmp = ee.Feature(shpdiv_part1, {'id_code_group': '3', 'analista': 'rafaela'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)
// adding group # 4
var featFiltered = feat_bacias.filterBounds(g4).union().geometry();
var feat_reg_tmp = ee.Feature(featFiltered, {'id_code_group': '4', 'analista': 'matias'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)
// adding group # 5
var featFiltered = feat_bacias.filterBounds(g5).union().geometry();
var feat_reg_tmp = ee.Feature(featFiltered, {'id_code_group': '5', 'analista': 'rafaela'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)
// adding group # 6
var feat_reg_tmp = ee.Feature(shpdiv_part2B, {'id_code_group': '6', 'analista': 'maria'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)
// adding group # 7
var featFiltered = feat_bacias.filterBounds(g7).union().geometry();
var feat_reg_tmp = ee.Feature(featFiltered, {'id_code_group': '7', 'analista': 'matias'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)
// adding group # 8
var featFiltered = feat_bacias.filterBounds(g8).union().geometry();
var feat_reg_tmp = ee.Feature(featFiltered, {'id_code_group': '8', 'analista': 'matias'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)
// adding group # 9
var featFiltered = feat_bacias.filterBounds(g9).union().geometry();
var feat_reg_tmp = ee.Feature(featFiltered, {'id_code_group': '9', 'analista': 'rafaela'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)
// adding group # 10
var featFiltered = feat_bacias.filterBounds(g10).union().geometry();
var feat_reg_tmp = ee.Feature(featFiltered, {'id_code_group': '10', 'analista': 'matias'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)
// adding group # 11
var featFiltered = feat_bacias.filterBounds(g11).union().geometry();
var feat_reg_tmp = ee.Feature(featFiltered, {'id_code_group': '11', 'analista': 'maria'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)
// adding group # 12
var featFiltered = feat_bacias.filterBounds(g12).union().geometry();
var feat_reg_tmp = ee.Feature(featFiltered, {'id_code_group': '12', 'analista': 'maria'});
feat_reg_tmp = feat_reg_tmp.set('área', feat_reg_tmp.area());
list_regions = list_regions.add(feat_reg_tmp)


var feats_all_join = ee.FeatureCollection(list_regions);
Map.addLayer(feats_all_join, {color: '#874f22'}, 'regions joined');

export_table(feats_all_join, 'shp_basingroup_fogo_joined');