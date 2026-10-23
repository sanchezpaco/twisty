import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { holdViewportHeight } from './lib/viewport'

holdViewportHeight()

export default mount(App, { target: document.getElementById('app')! })
