var param = {
    'asset_region_basin' : 'projects/dsak-463213/assets/shps_public/shp_basingroup_fogo_joined',
    'asset_recort_amaz': 'projects/dsak-463213/assets/shps_public/sep_geofogo_joined',
}


var feat_bacias = ee.FeatureCollection(param.asset_region_basin);
print(" show size features ", feat_bacias.size());
var feat_recort = ee.FeatureCollection(param.asset_recort_amaz);

Map.addLayer(ee.Image.constant(1), {min:0, max: 1}, 'base');
Map.addLayer(feat_bacias, {color : '#c7212aff'}, 'regions basin');

var bounder = ee.Image().byte().paint({
  featureCollection: feat_recort,
  color: 1,
  width: 1.5
});
Map.addLayer(bounder, {palette: '#75440c'}, 'region Amaz');