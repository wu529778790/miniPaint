import app from './../app.js';
import config from './../config.js';
import { Base_action } from './base.js';

export class Insert_layer_action extends Base_action {
	/**
	 * Creates new layer
	 *
	 * @param {object} settings
	 * @param {boolean} can_automate
	 */
	constructor(settings, can_automate = true) {
		super('insert_layer', 'Insert Layer');
		this.settings = settings;
		this.can_automate = can_automate;
		this.previous_auto_increment = null;
		this.previous_selected_layer = null;
		this.inserted_layer_id = null;
		this.update_layer_action = null;
		this.delete_layer_action = null;
		this.autoresize_canvas_action = null;
	}

	async do() {
		super.do();
		this.previous_auto_increment = app.Layers.auto_increment;
		this.previous_selected_layer = config.layer;
		let autoresize_as = null;

		// Default data
		const layer = {
			id: app.Layers.auto_increment,
			parent_id: 0,
			name: config.TOOL.name.charAt(0).toUpperCase() + config.TOOL.name.slice(1) + ' #' + app.Layers.auto_increment,
			type: null,
			link: null,
			x: 0,
			y: 0,
			width: 0,
			width_original: null,
			height: 0,
			height_original: null,
			visible: true,
			is_vector: false,
			hide_selection_if_active: false,
			opacity: 100,
			order: app.Layers.auto_increment,
			composition: 'source-over',
			rotate: 0,
			data: null,
			params: {},
			status: null,
			color: config.COLOR,
			filters: [],
			render_function: null,
		};

		// Build data
		for (let i in this.settings) {
			if (typeof layer[i] == "undefined") {
				alertify.error('Error: wrong key: ' + i);
				continue;
			}
			layer[i] = this.settings[i];
		}

		// Prepare image
		let image_load_promise;
		if (layer.type == 'image') {
			
			if(layer.name.toLowerCase().indexOf('.svg') == layer.name.length - 4){
				// We have svg
				layer.is_vector = true;
			}

			if (config.layers.length == 1 && config.layer.width == 0
				&& config.layer.height == 0 && config.layer.data == null) {
				// Remove first empty layer

				this.delete_layer_action = new app.Actions.Delete_layer_action(config.layer.id, true);
				this.delete_layer_action.do();
			}

			if (layer.link == null) {
				if (typeof layer.data == 'object') {
					// Load actual image
					if (layer.width == 0)
						layer.width = layer.data.width;
					if (layer.height == 0)
						layer.height = layer.data.height;
					layer.link = layer.data.cloneNode(true);
					layer.link.onload = function () {
						config.need_render = true;
					};
					layer.data = null;
					autoresize_as = [config.layer.width, config.layer.height];
					need_autoresize = true;
				}
				else if (typeof layer.data == 'string') {
					image_load_promise = new Promise((resolve, reject) => {
						// Try loading as imageData
						layer.link = new Image();
						layer.link.onload = () => {
							// Update dimensions
							if (layer.width == 0)
								layer.width = layer.link.width;
							if (layer.height == 0)
								layer.height = layer.link.height;
							if (layer.width_original == null)
								layer.width_original = layer.width;
							if (layer.height_original == null)
								layer.height_original = layer.height;
							// Free data
							layer.data = null;
							autoresize_as = [layer.width, layer.height, layer.id, this.can_automate];
							config.need_render = true;
							resolve();
						};
						layer.link.onerror = (error) => {
							resolve(error);
							alertify.error('Sorry, image could not be loaded.');
						};
						layer.link.src = layer.data;
						layer.link.crossOrigin = "Anonymous";
					});
				}
				else {
					alertify.error('Error: can not load image.');
				}
			}
		}

		if (this.settings != undefined && config.layers.length > 0
			&& config.layer.width == 0 && config.layer.height == 0
			&& config.layer.data == null && layer.type != 'image' && this.can_automate !== false) {
			// Update existing layer, because it's empty
			delete layer.name;
			this.update_layer_action = new app.Actions.Update_layer_action(config.layer.id, layer);
			await this.update_layer_action.do();
		}
		else {
			// Create new layer
			config.layers.push(layer);
			config.layer = app.Layers.get_layer(layer.id);
			app.Layers.auto_increment++;

			if (config.layer == null) {
				config.layer = config.layers[0];
			}

			this.inserted_layer_id = layer.id;
		}

		if (layer.id >= app.Layers.auto_increment)
			app.Layers.auto_increment = layer.id + 1;

		if (image_load_promise) {
			await image_load_promise;
		}

		if (autoresize_as) {
			this.autoresize_canvas_action = new app.Actions.Autoresize_canvas_action(...autoresize_as);
			try {
				await this.autoresize_canvas_action.do();
			} catch(error) {
				this.autoresize_canvas_action = null;
			}
		}

		app.Layers.render();
		app.GUI.GUI_layers.render_layers();
	}

	async undo() {
		super.undo();
		app.Layers.auto_increment = this.previous_auto_increment;
		if (this.autoresize_canvas_action) {
			await this.autoresize_canvas_action.undo();
			this.autoresize_canvas_action = null;
		}
		if (this.inserted_layer_id) {
			await new app.Actions.Delete_layer_action(this.inserted_layer_id, true).do();
			this.inserted_layer_id = null;
		}
		if (this.update_layer_action) {
			await this.update_layer_action.undo();
			this.update_layer_action = null;
		}
		if (this.delete_layer_action) {
			await this.delete_layer_action.undo();
			this.delete_layer_action = null;
		}
		config.layer = this.previous_selected_layer;
		this.previous_selected_layer = null;

		app.Layers.render();
		app.GUI.GUI_layers.render_layers();
	}

	free() {
		this.delete_layer_action = null;
		this.update_layer_action = null;
		this.previous_selected_layer = null;
	}
}