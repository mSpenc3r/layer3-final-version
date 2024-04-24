import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import './App.css'; 

const ThreeGeoJSON = () => {
  const [hoverData, setHoverData] = useState(null);
  const [isPanelOpen, setPanelOpen] = useState(false); // State to manage panel visibility
  const sceneRef = useRef(null);

  // Function to toggle the description panel
  const togglePanel = () => {
    setPanelOpen(!isPanelOpen);
  };

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x172028);
    const axesHelper = new THREE.AxesHelper( 10 );
     
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(100, 100, 100); // Set position before initializing controls
  
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    sceneRef.current.appendChild(renderer.domElement);
    console.log("Camera Position after setting:", camera.position);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);  // Confirm this is the desired target
    camera.position.set(100, 100, 100); // Reset position after setting target
    controls.update();

    const light = new THREE.AmbientLight(0x404040);
    scene.add(light);

    function onWindowResize() {
  // Adjust camera
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // Adjust renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);

  // This forces a re-render with the new size
  renderer.render(scene, camera);
}
  
    // Add resize event listener
    window.addEventListener('resize', onWindowResize);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const spheres = []; // Array to store spheres for raycasting

    const colorPalette = [
      "rgb(26, 40, 55)",
      "rgb(46, 62, 77)",
      "rgb(60, 69, 108)",
      "rgb(83, 77, 138)",
      "rgb(131, 76, 149)",
      "rgb(158, 63, 143)",
      "rgb(186, 69, 137)",
      "rgb(189, 52, 185)",
      "rgb(204, 42, 177)",
      "rgb(255, 113, 146)",
      "rgb(255, 155, 175)"
    ];

    const loadGeoJSON = async () => {
      const response = await fetch(`${process.env.PUBLIC_URL}/polygons.json`);
      const data = await response.json();
      data.features.forEach((feature) => {
        const { ZCTA5CE10, r_coi_nat, fraction_nonwhite, centroid, INTPTLAT10, INTPTLON10 } = feature.properties;
        const stackHeight = drawPolygonWithStack(feature, 0.15, 0.15);  // Assuming stackHeight is calculated as before
        if (centroid) {
          createSphereAtCentroid(centroid[1], centroid[0], r_coi_nat, stackHeight, { ZCTA5CE10, r_coi_nat, fraction_nonwhite, INTPTLAT10, INTPTLON10 });
        } else {
          const coordinates = feature.geometry.coordinates[0];
          const calculatedCentroid = calculateCentroid(coordinates);
          createSphereAtCentroid(calculatedCentroid.lat, calculatedCentroid.lng, r_coi_nat, stackHeight, { ZCTA5CE10, r_coi_nat, fraction_nonwhite, INTPTLAT10, INTPTLON10 });
        }
      });
      scene.position.set(0, 0, 0);  // Reset position
      scene.rotation.set(0, 0, 0);  // Reset rotation

      const radians = THREE.MathUtils.degToRad(-75); // Convert degrees to radians
      scene.rotation.x = radians; // Apply the rotation to the scene
      scene.scale.x = -1; // Flip horizontally
      scene.rotation.z = Math.PI;
      adjustCamera(scene);
    };

    const calculateCentroid = (coordinates) => {
      let centroid = { lng: 0, lat: 0 };
      coordinates.forEach(([lng, lat]) => {
        centroid.lng += lng;
        centroid.lat += lat;
      });
      const length = coordinates.length;
      centroid.lng /= length;
      centroid.lat /= length;
      return centroid;
    };

    const createSphereAtCentroid = (lat, lng, rCoiNat, stackHeight, properties) => {
      const { ZCTA5CE10, r_coi_nat, fraction_nonwhite, INTPTLAT10, INTPTLON10 } = properties;  // Destructure the properties
      const x = (lng + 180) * (window.innerWidth / 360);
      const y = (lat - 90) * -(window.innerHeight / 180);
      const z = 0.5 + stackHeight;
    
      const visibleGeometry = new THREE.SphereGeometry(0.05, 32, 32);
      const visibleMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x000000 });
      const visibleSphere = new THREE.Mesh(visibleGeometry, visibleMaterial);
      visibleSphere.position.set(x, y, z);
    
      const invisibleGeometry = new THREE.SphereGeometry(0.25, 32, 32);
      const invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false });
      const invisibleSphere = new THREE.Mesh(invisibleGeometry, invisibleMaterial);
      invisibleSphere.position.set(x, y, z);
    
      // Add the visible sphere to the invisible sphere group for combined transformations
      const group = new THREE.Group();
      group.add(visibleSphere);
      group.add(invisibleSphere);
    
      // Store relevant data for hover display
      invisibleSphere.userData = {
        isClickable: true,
        visibleSphere: visibleSphere,
        properties: {
          ZCTA5CE10: ZCTA5CE10,
          r_coi_nat: r_coi_nat,
          fraction_nonwhite: fraction_nonwhite,
          INTPTLAT10: INTPTLAT10,
          INTPTLON10: INTPTLON10

        }
      };
    
      scene.add(group);
      spheres.push(invisibleSphere);  // Add to your spheres array for raycasting
    };

    const drawPolygonWithStack = (feature, heightOffset) => {
      const fractionNonwhite = feature.properties.fraction_nonwhite;
      const layers = Math.ceil(fractionNonwhite / 10);
      const coordinates = feature.geometry.coordinates[0];
      let stackHeight = 0; // Initialize stack height
      for (let i = 0; i <= layers; i++) {
        const scaleFactor = 1 - (i * 0.105);
        const zOffset = i * heightOffset;
        stackHeight += heightOffset; // Accumulate total height
        addPolygonAndStroke(coordinates, scaleFactor, zOffset, i);
      }
      return stackHeight; // Return the total height of the stack
    };

    const addPolygonAndStroke = (coordinates, scaleFactor, zOffset, layerIndex) => {
      const scaledCoordinates = scaleCoordinates(coordinates, scaleFactor);
      const shape = createShapeFromCoordinates(scaledCoordinates);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false });
      const materialColor = new THREE.Color(colorPalette[layerIndex % colorPalette.length]);
      const material = new THREE.MeshBasicMaterial({ color: materialColor, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = zOffset;
      scene.add(mesh);
    };

    const createShapeFromCoordinates = (coordinates) => {
      const shape = new THREE.Shape();
      coordinates.forEach(([lng, lat], index) => {
        const x = (lng + 180) * (window.innerWidth / 360);
        const y = (lat - 90) * -(window.innerHeight / 180);
        if (index === 0) {
          shape.moveTo(x, y);
        } else {
          shape.lineTo(x, y);
        }
      });
      return shape;
    };

    const scaleCoordinates = (coordinates, scaleFactor) => {
      let centroid = { x: 0, y: 0 };
      coordinates.forEach(([lng, lat]) => {
        centroid.x += lng;
        centroid.y += lat;
      });
      centroid.x /= coordinates.length;
      centroid.y /= coordinates.length;
      return coordinates.map(([lng, lat]) => [
        centroid.x + (lng - centroid.x) * scaleFactor,
        centroid.y + (lat - centroid.y) * scaleFactor,
      ]);
    };

    const adjustCamera = (scene) => {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / 4 * Math.tan(fov * 2)); // Adjust camera distance based on the object size and field of view
      
      // Set camera to a 45-degree angle looking down at the scene
      camera.position.set(center.x + cameraZ / Math.sqrt(2), center.y + cameraZ / Math.sqrt(2), center.z + cameraZ);
      
      // Point the camera towards the center of the bounding box
      camera.lookAt(center);
      const halfPi = Math.PI / 2;
      controls.minPolarAngle = halfPi - THREE.MathUtils.degToRad(90); // -90 degrees (downwards)
      controls.maxPolarAngle = halfPi;
      // Update the orbit controls to use the new camera position
      controls.target.set(center.x, center.y, center.z);
      controls.update();
    };

    const onMouseMove = (event) => {
      event.preventDefault();
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(spheres, true);
    
      // Reset all spheres' glow
      spheres.forEach(sphere => sphere.userData.visibleSphere.material.emissive.setHex(0x000000));
    
      if (intersects.length > 0) {
        const intersectedSphere = intersects[0].object;
        // Set glow
        intersectedSphere.userData.visibleSphere.material.emissive.setHex(0xffff00);
    
        // Display data
        setHoverData(intersectedSphere.userData.properties);
      } else {
        setHoverData(null);
      }
    };
    
    window.addEventListener('mousemove', onMouseMove);

    loadGeoJSON();

    const animate = () => {
      requestAnimationFrame(animate);
    
      // Automatically rotate the camera around the origin
      const rotationSpeed = 1; // Adjust rotation speed as needed
      controls.autoRotate = true; // Enable auto-rotate
      controls.autoRotateSpeed = rotationSpeed; // Set auto-rotate speed: positive for clockwise, negative for counter-clockwise
    
      controls.update(); // Required if controls.enableDamping or controls.autoRotate are set to true
      renderer.render(scene, camera);
      
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onWindowResize);

      if (sceneRef.current) {
    sceneRef.current.removeChild(renderer.domElement);
  }
  renderer.dispose(); // Clean up resources used by the renderer
  };
  }, []);
  const colorDescriptions = [
    { color: "#1a2837", label: "Least Fraction NonWhite" },
    { color: "#3c456c", label: "Low Fraction NonWhite" },
    { color: "#834c95", label: "Medium Fraction NonWhite" },
    { color: "#ba4589", label: "High Fraction NonWhite" },
    { color: "#cc2ab1", label: "Very High Fraction NonWhite" },
    { color: "#ff9baf", label: "Highest Fraction NonWhite" }
    // Add more entries as needed
  ];
  return (
    <>
      <div className="overlay-container">
        <header className="overlay-header">
          <h1>Decoding Child Opportunity</h1>
          <h2 className="overlay-subtitle">ARTG1600 - Max Spencer</h2>
        </header>
        
        <div ref={sceneRef} />

        <div className="bottom-left-container">
          <div className="legend-container">
            <h4 className="legend-header">Polygon Color Key</h4>
            <ul className="legend-list">
              {colorDescriptions.map((item, index) => (
                <li key={index} className="legend-item">
                  <span className="legend-color-box" style={{ backgroundColor: item.color }}></span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
          {hoverData && (
            <div className="info-panel">
              <h4 className="info-header">Details</h4>
              <p><strong>Zipcode:</strong> {hoverData.ZCTA5CE10}</p>
              <p><strong>Child Opportunity Index:</strong> {hoverData.r_coi_nat}</p>
              <p><strong>Fraction Nonwhite Population:</strong> {hoverData.fraction_nonwhite}</p>
              <p><strong>Latitude:</strong> {hoverData.INTPTLAT10}</p>
              <p><strong>Longitude:</strong> {hoverData.INTPTLON10}</p>
            </div>
          )}
        </div>

        <div className={`description-panel ${isPanelOpen ? 'open' : ''}`}>
          <h2>Description</h2>
          <p>This dataset form DiversityDataKids is data collected from zipcodes in the United States
             about child opportunity indexes. This overall child opportunity index can be broken down
            into 3 categories that are used to calculate it, healthcare, education and socioeconomic
            status, which have various weights that I have identified using linear regression methods.
            Here, I am visualizing the relationship between the percentage of nonwhite population per
            zipcode, and primarily compare it to the overall COI. The higher the height of the polygon
            stack, the higher the nonwhite population, and unfortunately the lower the opportunity index.
            This makes it incredibly clear where the city of Boston needs to invest resources in order
            to uplift these communities and raise the opportunity for children, creating a more equitable
            environment for all in Massachusetts.</p>
        </div>
        <button className="arrow-toggle" onClick={togglePanel}></button>
      </div>
    </>
  );
  
};

export default ThreeGeoJSON;
