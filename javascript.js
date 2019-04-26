//aef2905651cbdba3bfd2c1e5604fb6e5

(function() {

    //  Workaround for 1px lines appearing in some browsers due to fractional transforms
    //  and resulting anti-aliasing.
    //  https://github.com/Leaflet/Leaflet/issues/3575
    if (window.navigator.userAgent.indexOf('Chrome') > -1) {
        var originalInitTile = L.GridLayer.prototype._initTile;
        L.GridLayer.include({
            _initTile: function (tile) {
                originalInitTile.call(this, tile);
                var tileSize = this.getTileSize();
                tile.style.width = tileSize.x + 1 + 'px';
                tile.style.height = tileSize.y + 1 + 'px';
            }
        });
    }

    // Set Kortforsyningen token, replace with your own token
    var kftoken = 'aef2905651cbdba3bfd2c1e5604fb6e5';

    // Set the attribution (the copyright statement shown in the lower right corner)
    // We do this as we want the same attributions for all layers
    var myAttributionText = '&copy; <a target="_blank" href="https://download.kortforsyningen.dk/content/vilk%C3%A5r-og-betingelser">Styrelsen for Dataforsyning og Effektivisering</a>';


    // Make the map object using the custom projection
    //proj4.defs('EPSG:25832', "+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs");
    var crs = new L.Proj.CRS('EPSG:25832',
	'+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs', {
        resolutions: [1638.4,819.2,409.6,204.8,102.4,51.2,25.6,12.8,6.4,3.2,1.6,0.8,0.4,0.2],
        origin: [120000,6500000],
        bounds: L.bounds([120000, 5661139.2],[1378291.2, 6500000])
    });


    // Make the map object using the custom projection
    var map = new L.Map('map', {
        crs: crs,
        continuousWorld: true,
        center: [55.8, 11.4], // Set center location
        zoom: 9, // Set zoom level
        minzoom: 0,
        maxzoom: 16
    });

    // Define layers
    var ortofotowmts = L.tileLayer('https://services.kortforsyningen.dk/orto_foraar?token=' + kftoken + '&request=GetTile&version=1.0.0&service=WMTS&Layer=orto_foraar&style=default&format=image/jpeg&TileMatrixSet=View1&TileMatrix={zoom}&TileRow={y}&TileCol={x}', {
	      minZoom: 0,
        maxZoom: 16,
        attribution: myAttributionText,
        crossOrigin: true,
        zoom: function () {
            var zoomlevel = map._animateToZoom ? map._animateToZoom : map.getZoom();
            //console.log("WMTS: " + zoomlevel);
            if (zoomlevel < 10)
                return 'L0' + zoomlevel;
            else
                return 'L' + zoomlevel;
        }
    }).addTo(map);


    // Skærmkort [WMTS:topo_skaermkort]
    var toposkaermkortwmts = L.tileLayer.wms('https://services.kortforsyningen.dk/topo_skaermkort', {
        layers: 'dtk_skaermkort',
        token: kftoken,
        format: 'image/png',
        attribution: myAttributionText
    }).addTo(map);

    // Matrikelskel overlay [WMS:mat]
    var matrikel = L.tileLayer.wms('https://services.kortforsyningen.dk/mat', {
        transparent: true,
        layers: 'MatrikelSkel,Centroide',
        token: kftoken,
        format: 'image/png',
        attribution: myAttributionText,
        continuousWorld: true,
        minZoom: 9
    }); // addTo means that the layer is visible by default

    // Hillshade overlay [WMS:dhm]
    var hillshade = L.tileLayer.wms('https://services.kortforsyningen.dk/dhm', {
        transparent: true,
        layers: 'dhm_terraen_skyggekort_transparent_overdrevet',
        token: kftoken,
        format: 'image/png',
        attribution: myAttributionText,
        continuousWorld: true,
    });

    // Define layer groups for layer control
    var baseLayers = {
        "Ortofoto WMTS": ortofotowmts,
        "Skærmkort WMTS": toposkaermkortwmts
    };
    var overlays = {
        "Matrikel": matrikel,
        "Hillshade": hillshade
    };

    // Add layer control to map
    L.control.layers(baseLayers, overlays).addTo(map);

    // Add scale line to map
    L.control.scale({imperial: false}).addTo(map); // disable feet units


    var forhandlere = [];
    fetch("forhandlere.json").then(function (res) {
      return res.json();
    }).then(function (data) {
      L.geoJSON(data, {
        onEachFeature: (feature, layer) => forhandlere.push(layer)
      }).addTo(map);
      //knn = leafletKnn(forhandlere)
    });

    function showNearest(nearest) {
      var results = document.querySelector("#searchresults");
      results.innerHTML = nearest.map(e => `<p>${e.layer.feature.properties.navn}: ${e.layer.feature.properties.adresse} <br> (${L.GeometryUtil.readableDistance(e.distance)})</p>`).join("");
    }

    var search = document.querySelector("#searchpostcode");
    var postcode = document.querySelector("#postcode");
    search.addEventListener("click", function () {
      fetch("https://dawa.aws.dk/postnumre/" + postcode.value).then(function (res) {
        return res.json();
      }).then(function (data) {
        var center = L.latLng(data.visueltcenter[1], data.visueltcenter[0]);
        map.panTo(center);
        var nearest = L.GeometryUtil.nClosestLayers(map, forhandlere, center, 3);
        showNearest(nearest);
        let points = nearest.map(x => [x.latlng.lat, x.latlng.lng]);
        points.push(center);
        map.flyToBounds(points, { padding: [10,10]});
        //var nearest = knn.nearest(center, 500000);

      });

    });
    postcode.addEventListener("keypress", e => {
      if (e.keyCode == 13) {
        search.click();
      }
    });
    map.locate({
      setView: false,
      maxZoom: 16
    });

    let marker;
    function onlocationchange(e) {
      map.flyTo(e.latlng);
      var nearest = L.GeometryUtil.nClosestLayers(map, forhandlere, e.latlng, 3);
      showNearest(nearest);
      let us = [e.latlng.lat, e.latlng.lng];
      let points = nearest.map(x => [x.latlng.lat, x.latlng.lng]);
      points.push(us);
      map.flyToBounds(points, { padding: [10,10]});
      if (!marker) {
        marker = L.circleMarker(e.latlng, {
          color: '#ff0000'
        }).addTo(map);
      }
      else {
        marker.panTo(us);
      }
    }
    map.on('locationfound', onlocationchange);

})();
