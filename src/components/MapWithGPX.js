import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import { parseString } from 'xml2js';
import { LatLng, LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import exif from 'exif-js';
import L from 'leaflet';

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const commonIconProps = {
  iconSize: [12, 20], // half of the default size [25, 41]
  iconAnchor: [6, 20], // half of the default anchor [12, 41]
  popupAnchor: [0, -20], // half of the default popup anchor [1, -34]
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  shadowSize: [20, 20], // half of the default size [41, 41]
  shadowAnchor: [6, 20], // half of the default anchor [12, 41]
};


const iconColorList = ['green', 'black', 'blue', 'gold', 'grey', 'orange', 'red', 'violet', 'yellow'];

const iconList = iconColorList.map((color) => ({
  color,
  icon: new L.Icon({ iconUrl: `/images/marker/marker-icon-${color}.png`, ...commonIconProps }),
}));

const getIcon = (inColor) => (iconList.find(({ color }) => color === inColor) || iconList[0]).icon;

const FitBoundsControl = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds);
    }
  }, [bounds, map]);
  return null;
};

const MapWithGPX = () => {
  const [tracks, setTracks] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [bounds, setBounds] = useState(null);
  const [imageMarkers, setImageMarkers] = useState([]);
  const [highlightedWaypoint, setHighlightedWaypoint] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        parseString(text, (err, result) => {
          if (err) {
            console.error(err);
            return;
          }
          const trackPoints = result.gpx.trk[0].trkseg[0].trkpt.map(pt => new LatLng(pt.$.lat, pt.$.lon));
          setTracks([trackPoints]);

          // Calculate bounds
          const bounds = new LatLngBounds(trackPoints);
          setBounds(bounds);
          const wpts = result.gpx.wpt ? result.gpx.wpt.map(wpt => ({
            lat: wpt.$.lat,
            lon: wpt.$.lon,
            time: wpt.time || '',
            name: wpt.name ? wpt.name[0] : 'Waypoint'
          })) : [];
          setWaypoints(wpts);
        });
      };
      reader.readAsText(file);
    }
  };

  const handleDirectoryUpload = async (event) => {
    const files = (Array.from(event.target.files)).sort((a, b) => {
      return a.name > b.name ? 1 : -1;
    });
    const markers = [];

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          exif.getData(file, function() {
            const lat = exif.getTag(this, "GPSLatitude");
            const lon = exif.getTag(this, "GPSLongitude");
            const latRef = exif.getTag(this, "GPSLatitudeRef") || "N";
            const lonRef = exif.getTag(this, "GPSLongitudeRef") || "W";
            if (lat && lon) {
              const latitude = convertDMSToDD(lat, latRef);
              const longitude = convertDMSToDD(lon, lonRef);
              markers.push({ lat: latitude, lon: longitude, name: file.name });
              setImageMarkers([...markers]);
            }
          });
        };
        reader.readAsArrayBuffer(file);
      }
    }
    const fileList = [];
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target.result;
        fileList.push({ name: file.name, url });
        if (fileList.length === files.length) {
          setImageFiles(fileList);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const convertDMSToDD = (dms, ref) => {
    const degrees = dms[0];
    const minutes = dms[1];
    const seconds = dms[2];
    let dd = degrees + minutes/60 + seconds/(60*60);
    if (ref === "S" || ref === "W") {
      dd = dd * -1;
    }
    return dd;
  };

  const handleWaypointClick = (waypoint) => {
    setHighlightedWaypoint(waypoint);
  };

  const toLocalTime = (utcDateString) => {
    const utcDate = new Date(utcDateString);
    return utcDate.toLocaleString();
  };

  return (
    <div>
      <div style={{ marginTop: '10px', marginBottom: '10px' }}>
        gpx file: <input type="file" accept=".gpx" onChange={handleFileUpload} />
        image folder: <input type="file" accept="image/*" webkitdirectory="true" directory="true" onChange={handleDirectoryUpload} />
      </div>
      <MapContainer center={[0, 0]} zoom={2} style={{ height: "600px", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        {tracks.map((track, index) => (
          <Polyline key={index} positions={track} color="blue" />
        ))}
        {waypoints.map((wpt, index) => (
          <Marker key={index} position={[wpt.lat, wpt.lon]} icon={getIcon('green')}>
            <Popup>{wpt.name}</Popup>
          </Marker>
        ))}
        {imageMarkers.map((marker, index) => (
          <Marker key={index} position={[marker.lat, marker.lon]} icon={getIcon('red')}>
            <Popup>
              <div onClick={() => {
                const image = imageFiles.find(({ name }) => name === marker.name);
                    setSelectedImage(image);
              }}>
                {marker.name}
              </div>
            </Popup>
          </Marker>
        ))}
        {highlightedWaypoint && (
          <CircleMarker
            center={[highlightedWaypoint.lat, highlightedWaypoint.lon]}
            radius={10}
            fillColor="red"
            color="red"
            weight={1}
          />
        )}
        {bounds && <FitBoundsControl bounds={bounds} />}
      </MapContainer>
      <div style={{ marginTop: '20px', display: 'flex' }}>
        <div style={{ flex: 1, marginRight: '10px' }}>
          <h2>Waypoints</h2>
          <table border="1">
            <thead>
              <tr>
                <th>Time</th>
                <th>Name</th>
                <th>Latitude</th>
                <th>Longitude</th>
              </tr>
            </thead>
            <tbody>
              {waypoints.map((wpt, index) => (
                <tr key={index} onClick={() => handleWaypointClick(wpt)} style={{ cursor: 'pointer' }}>
                  <td>{toLocalTime(wpt.time)}</td>
                  <td>{wpt.name}</td>
                  <td>{wpt.lat}</td>
                  <td>{wpt.lon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, marginRight: '10px' }}>
          <h2>Images</h2>
          <table border="1">
            <thead>
              <tr>
                <th>Name</th>
                <th>Latitude</th>
                <th>Longitude</th>
              </tr>
            </thead>
            <tbody>
              {imageMarkers.sort((a, b) => a.name > b.name ? 1 : -1).map((wpt, index) => (
                <tr
                  key={index}
                  onClick={() => {
                    handleWaypointClick(wpt);
                    const image = imageFiles.find(({ name }) => name === wpt.name);
                    setSelectedImage(image);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{wpt.name}</td>
                  <td>{wpt.lat}</td>
                  <td>{wpt.lon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, marginRight: '10px' }}>
        {selectedImage && (
          <div>
            <h3>Selected Image: {selectedImage.name}</h3>
            <img src={`${selectedImage.url}`} alt={selectedImage.name} style={{ maxWidth: '100%' }} />
          </div>
        ) }
        </div>
      </div>
    </div>
  );
};

export default MapWithGPX;
