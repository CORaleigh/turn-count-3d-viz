import './style.css'
import { setupMap } from './map.js'

document.querySelector('#app').innerHTML = `
  <div id="mapDiv">
  </div>
`

setupMap(document.querySelector('#mapDiv'))
