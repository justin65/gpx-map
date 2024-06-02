import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import { parseString } from 'xml2js';
import { LatLng, LatLngBounds, Icon } from 'leaflet';
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

// Create a custom icon with half the size of the default icon
const smallIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconSize: [12, 20], // half of the default size [25, 41]
  iconAnchor: [6, 20], // half of the default anchor [12, 41]
  popupAnchor: [0, -20], // half of the default popup anchor [1, -34]
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  shadowSize: [20, 20], // half of the default size [41, 41]
  shadowAnchor: [6, 20], // half of the default anchor [12, 41]
});

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
            name: wpt.name ? wpt.name[0] : 'Waypoint'
          })) : [];
          setWaypoints(wpts);
        });
      };
      reader.readAsText(file);
    }
  };

  const handleDirectoryUpload = async (event) => {
    const files = Array.from(event.target.files);
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

  return (
    <div>
      <input type="file" accept=".gpx" onChange={handleFileUpload} />
      <input type="file" accept="image/*" webkitdirectory="true" directory="true" onChange={handleDirectoryUpload} />
      <MapContainer center={[0, 0]} zoom={2} style={{ height: "600px", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        {tracks.map((track, index) => (
          <Polyline key={index} positions={track} color="blue" />
        ))}
        {waypoints.map((wpt, index) => (
          <Marker key={index} position={[wpt.lat, wpt.lon]} icon={smallIcon}>
            <Popup>{wpt.name}</Popup>
          </Marker>
        ))}
        {imageMarkers.map((marker, index) => (
          <Marker key={index} position={[marker.lat, marker.lon]} icon={smallIcon}>
            <Popup>{marker.name}</Popup>
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
      <div style={{ marginTop: '20px' }}>
        <h2>Waypoints</h2>
        <table border="1">
          <thead>
            <tr>
              <th>Name</th>
              <th>Latitude</th>
              <th>Longitude</th>
            </tr>
          </thead>
          <tbody>
            {waypoints.map((wpt, index) => (
              <tr key={index} onClick={() => handleWaypointClick(wpt)} style={{ cursor: 'pointer' }}>
                <td>{wpt.name}</td>
                <td>{wpt.lat}</td>
                <td>{wpt.lon}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MapWithGPX;