// width of body to use as width for svg
var bodyWidth = d3.select('body').node().offsetWidth;
var windowHeight = window.innerHeight;

// want margins to be 10% of body width. should change maybe
var margin_sides = bodyWidth * 0.1;

// set margins
var margin = { top: 400, right: margin_sides, bottom: 400, left: margin_sides },
  width = bodyWidth - margin.left - margin.right,
  height = 5000 - margin.top - margin.bottom;

// percent two area charts can overlap
var overlap = 0.5;

// create svg with margins
var svg = d3.select('.joyplot-container')
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

// create separate svg for fixed x-axis that will be in scrollytelling
var fixed_axis_svg = d3.select('.scroll__graphic').append('svg')
					   .attr('width', width + margin.left + margin.right)
					   // put at the bottom of the screen but up 150px so axis fits. will need to make more dynamic
					   .attr('transform', 'translate(0, ' + (windowHeight - 150) + ')')
					   .attr('height', '100px')
					   .append('g')
					   // transform 20px downwards so x-axis fits within svg so doesn't get cut off, otherwise top of axis would get cut off
					   .attr('transform', 'translate(' + margin.left + ',' + 20 + ')');

// functions for finding x values
var x = function (d) { return d.date; };
var xScale = d3.scaleTime().range([0, width]);
var xValue = function (d) { return xScale(x(d)); };
var xAxis = d3.axisBottom(xScale)
			  .tickFormat(d3.timeFormat('%b'))
			  .tickArguments([d3.timeMonth.every(1)]);

// functions for finding y values
var y = function (d) { return d.mentions; };
var yScale = d3.scaleLinear();
var yValue = function (d) { return yScale(y(d)); };

// functions for finding values for each meme's name/joyplot. don't use axis anymore
var nameCalc = function (d) { return d.key; };
var nameScale = d3.scaleBand().range([0, height]);
var nameValue = function (d) { return nameScale(nameCalc(d)); };
var nameAxis = d3.axisLeft(nameScale);

// global variable to store the meme we're currently on
var current_index;
// global variable to keep track of whether we're using benchmarked data or not
var benchmarked = true;

// creates joyplot curve
var area = d3.area()
			 .curve(d3.curveMonotoneX)
			 .x(xValue)
			 .y1(yValue);

var line = area.lineY1();

// parses the dates that we get and creates date objects
var parseTime = d3.timeParse('%m/%d/%Y');

// following three format the date object
var timeFormat = d3.timeFormat('%B %e');
var month_numerical = d3.timeFormat('%m');
var month_full_text = d3.timeFormat('%B');

// removes spaces from meme names - used to make ID for each meme's joyplot container
var cleanString = function (string) {
	return string.replace(/[^A-Z0-9]+/ig, '');
};

// converts csv columns
var rowConverter = function (d) {
	return {
		name: d.meme,
		date: parseTime(d.date),
		mentions: +d.index,
		benchmarked_mentions: +d.benchmarked_index
  };
};

// import data from csv
d3.csv('meme_interest_data_stacked.csv', rowConverter, function (error, dataset) {
	if (error) { throw error; }
	
	// Sort all data by time
	dataset.sort(function (a, b) { return a.date - b.date; });
	
	// created nested dataset using meme name as key
	var data = d3.nest()
				 .key(function (d) { return d.name; })
		         .entries(dataset);

	// for each meme, find the peak index and peak date that that happened on. append those values to the meme in the dataset
	function findPeaks (d) {
		for (var i in d) {
			var topic_values = d[i].values;
			var max_index = d3.scan(topic_values, function (a, b) { return y(b) - y(a); });
			var peakTime = x(topic_values[max_index]);
			var peakMentions = y(topic_values[max_index]);
			d[i].peakTime = peakTime;
			d[i].peakMentions = peakMentions;
		}
	}
	
	// run findPeaks function on our dataset
	findPeaks(data);
	
	// sort memes by peak time
	data.sort(function (a, b) { return a.peakTime - b.peakTime; });

	// set domain for x scale and name scale now that we have dataset ready to go
	xScale.domain(d3.extent(dataset, x));
	nameScale.domain(data.map(function (d) { return d.key; }));
	
	// height of a joyplot is overlap % times the height of svg divided by number of names
	var areaChartHeight = (1 + overlap) * (height / nameScale.domain().length);
	
	// set domain and range for y scale
	yScale.domain([0, d3.max(dataset, function (d) {
		return d.mentions;
	})])
		.range([areaChartHeight, 0]);
	
	// set y0 value of area
	area.y0(yScale(0));
	
	// set step container to be height of svg and start at first joyplot
	d3.select('.scroll__text')
		.style('height', function () {
			return height + margin.top + margin.bottom + 'px';
	})
		.style('top', function () {
			return margin.top - nameScale.bandwidth() + 'px';
	});

	// create a step for each joyplot that's the height of the joyplot w/o the overlap
	var number_of_steps = data.length;
	var counter = 0;
	while (counter < number_of_steps) {
		d3.select('.scroll__text')
			.append('div')
			.attr('class', 'step')
			.style('top', function () {
				return nameScale.bandwidth() * counter + 
					(nameScale.bandwidth() * overlap) + 'px';
		})
			.style('height', function () {
				return nameScale.bandwidth() + 'px';
		});
		
		counter++;
	}

	// create a group for each meme's joyplot
	var gName = svg.append('g')
					.attr('class', 'names')
					.selectAll('.name')
					.data(data)
					.enter()
					.append('g')
					.attr('class', function (d) { return 'name--' + cleanString(d.key); })
					.attr('transform', function (d) {
						var translate_offset = nameValue(d);
						return 'translate(0,' + translate_offset + ')';
					});

	// the following two things create the joyplot
	// on each gName, append an area for the values
	gName.append('path')
		 .attr('class', 'area')
		 .datum(function (d) { return d.values; })
		 .attr('d', area);

	// on each gName, append a line for the values
	gName.append('path')
		.attr('class', 'line')
		.datum(function (d) { return d.values; })
		.attr('d', line);
	
	// set variables for each container we have, and also set the scroll container to be height of svg
	var container = d3.select('#scroll');
	container.style('height', function () {
		return height + 'px';
  });
  
	var graphic = container.select('.scroll__graphic');
	var text = container.select('.scroll__text');
	var step = text.selectAll('.step');
				
	// initialize the scrollama
	var scroller = scrollama();
	
	// generic window resize listener event - need to make
	// scrollama event handlers
	function handleStepEnter (response) {
		// response = { element, direction, index }
		// remove previous annotation
		d3.selectAll('.annotation-group').remove();
		
		// set opacity back to 1s
		d3.select('g.names')
			.selectAll('g')
			.attr('opacity', '1');

		// set some variables
		var index, direction, name, peakTime, peakMentions;
		
		// not in use right now
		direction = response.direction;
		
		// index of step matches index of corresponding joyplot in dataset
		index = response.index;
		current_index = index;
		
		// name, peak time, and peak mentions for the meme we're on
		name = data[index].key;
		peakTime = data[index].peakTime;
		peakMentions = data[index].peakMentions;
		
		// if peak time is past halfway through year, move meme image/title. need to update to make sense for all screen sizes
		if (month_numerical(peakTime) >= 6) {
			d3.select('.tweet').style('left', function () {
				return margin_sides + 'px';
			});
			d3.select('.meme-name-container').style('left', '50%');
		} else if (month_numerical(peakTime) <= 6) {
			d3.select('.tweet').style('left', '55%');
			d3.select('.meme-name-container').style('left', '15%');
		}
		
		// moves cute little red circle
		d3.select('.date-circle')
			.attr('cx', xScale(peakTime));
		
		// change to current meme name
		d3.select('.meme-name')
			.text(name);

		// change to current meme peak month
		d3.select('.month')
			.text(month_full_text(peakTime));
		
		var nameNoSpace = cleanString(name);
		
		// set opacity for all joyplots to .1, and then set the opacity for the joyplot we're on to 1
		d3.select('g.names')
			.selectAll('g')
			.attr('opacity', '.1')
			.filter(function () {
			var className = 'name--' + nameNoSpace;
			if (d3.select(this).attr('class') == className) {
				return true;
			} else {
				return false;
			}
		})
			.attr('opacity', '1');
		
		// create annotations
		createAnnotations(index);
	}
				
	// fix sticky graphic when enter container
	function handleContainerEnter (response) {
		// response = { direction }
		// old school
		// sticky the graphic
		graphic.classed('is-fixed', true);
		graphic.classed('is-bottom', false);
	}
	
	// un fix sticky graphic when exit container
	function handleContainerExit (response) {
		// response = { direction }
		// old school
		// un-sticky the graphic, and pin to top/bottom of container
		graphic.classed('is-fixed', false);
		graphic.classed('is-bottom', response.direction === 'down');
	}
	
	function init () {
		// 1. force a resize on load to ensure proper dimensions are sent to scrollama
		// 2. setup the scroller passing options
		// this will also initialize trigger observations
		// 3. bind scrollama event handlers (this can be chained like below)
		scroller.setup({
			container: '#scroll',
			graphic: '.scroll__graphic',
			text: '.scroll__text',
			step: '.scroll__text .step',
			debug: false,
			offset: 0.85
		})
			.onStepEnter(handleStepEnter)
			.onContainerEnter(handleContainerEnter)
			.onContainerExit(handleContainerExit);
		// setup resize event
	}
	
	// kick things off
	init();
	
	// create x axis in fixed svg
	fixed_axis_svg.append('g')
		.attr('class', 'x-axis')
		.call(xAxis);
	
	// create cute little red circle
	fixed_axis_svg.append('circle')
		.attr('class', 'date-circle')
		.attr('cx', 1)
		.attr('cy', 0)
		.attr('r', 5)
		.attr('fill', 'red')
		.transition();
	
	// update data from benchmarked to not benchmarked
	d3.select('.change-data-button')
		.on('click', function () {
		changeData();
		
		createAnnotations(current_index);
	});


	// create annotations
	function createAnnotations (index) {
		// remove any existing annotations
		d3.selectAll('.annotation-group').remove();
		var name = data[index].key;
		var peakTime = data[index].peakTime;
		var peakMentions = data[index].peakMentions;
		
		const type = d3.annotationCallout;
		const annotations = [{
			note: {
				title: 'Index of ' + peakMentions
			},
			
			// can use x, y directly instead of data
			data: { date: peakTime, mentions: peakMentions},
			dy: -25,
			dx: 25
		}];

    const makeAnnotations = d3.annotation()
								.type(type)
								// accessors & accessorsInverse not needed
								// if using x, y in annotations JSON
								.accessors({
									x: d => xScale(d.date),
									y: d => yScale(d.mentions)
								})
								.accessorsInverse({
									date: d => xScale.invert(d.x),
									close: d => yScale.invert(d.y)
								})
						.annotations(annotations);

    var nameNoSpace = cleanString(name);
	// using name, find the joyplot group that has that name as its class name and create annotation for it
	d3.select('g.name--' + nameNoSpace)
		.append('g')
		.attr('class', 'annotation-group')
		.call(makeAnnotations);
	}
	
	// update data from benchmarked to non-benchmarked
	function changeData () {
		// update y function to look at benchmarked_mentions instead of normal mentions
		if (benchmarked) {
			y = function (d) { return d.benchmarked_mentions; };
			yScale.domain([0, d3.max(dataset, function (d) {
				return d.benchmarked_mentions;
			})]);
			benchmarked = false;
			
		} else {
			y = function (d) { return d.mentions; };
			yScale.domain([0, d3.max(dataset, function (d) {
				return d.mentions;
			})]);
			benchmarked = true;
		}
		
		// update area calculation with new y scale
		area.y0(yScale(0));
		// re-calculate values for peak times and peak mentions based on new data
		function findPeaks (d) {
			for (var i in d) {
				var topic_values = d[i].values;
				var max_index = d3.scan(topic_values, function (a, b) { return y(b) - y(a); });
				var peakTime = x(topic_values[max_index]);
				var peakMentions = y(topic_values[max_index]);
				d[i].peakTime = peakTime;
				d[i].peakMentions = peakMentions;
			}
		}
		findPeaks(data);
		
		// update x scale and name scale
		xScale.domain(d3.extent(dataset, x));
		nameScale.domain(data.map(function (d) { return d.key; }));
		
		// update data for area/line charts based on new data values
		gName.select('path.area')
			.datum(function (d) { return d.values; })
			.transition()
			.duration(1200)
			.attr('d', area);
		
		gName.select('path.line')
			.datum(function (d) { return d.values; })
			.transition()
			.duration(1200)
			.attr('d', line);
	}
});