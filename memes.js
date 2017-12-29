// width of window
var windowWidth = window.innerWidth;
var screenWidth = screen.width;
var windowHeight = window.innerHeight;
var side_margin = windowWidth * .1;
var top_margin = windowHeight * .7;

// set margins - need to make dynamic eventually
var margin = {left: side_margin, right: side_margin, top: top_margin, bottom: 400};

// percent two area charts can overlap
var overlap = 0.5;

//svg container and svg transform value
if (screenWidth < 763 || windowWidth < 763) {
	var svg_container_height = 4000;
} else {
	var svg_container_height = 7000;
}

var svg_height = svg_container_height - margin.top - margin.bottom;
var joyplot_width = d3.select('.joyplot-container').node().offsetWidth;

// create svg with margins
var svg = d3.select('.joyplot-container')
			.append('svg')
        .attr('viewBox', '0, 0, ' + joyplot_width + ", " + svg_container_height)
				.attr('width', '100%')
				.attr('height', svg_container_height)
        .attr("preserveAspectRatio", "none")
			.append('g')
			  .attr('transform', 'translate(0,' + margin.top + ')');

// create separate svg for fixed x-axis that will be in scrollytelling
var fixed_axis_svg = d3.select('.scroll__graphic')
											 .append('svg')
										     .attr('width', '100%')
										     // put at the bottom of the screen
										     .attr('transform', 'translate(0,' + 10 + ')')
										     .attr('height', '100px')
										   .append('g')
										     // transform 20px downwards so x-axis fits within svg so doesn't get cut off, otherwise top of axis would get cut off
					               .attr('width', '80%')
					               .attr('transform', 'translate(' + margin.left + ',' + 20 + ')');

// functions for finding x values
var x = function (d) { return d.date; };
var xScale = d3.scaleTime().range([0, joyplot_width]);
var xValue = function (d) { return xScale(x(d)); };
var xAxis = d3.axisBottom(xScale)
			  .tickFormat(d3.timeFormat('%b'))
				.tickSizeOuter([0]);

// functions for finding y values
var y = function (d) { return d.mentions; };
var yScale = d3.scaleLinear();
var yValue = function (d) { return yScale(y(d)); };

// functions for finding values for each meme's name/joyplot. don't use axis anymore
var nameCalc = function (d) { return d.key; };
var nameScale = d3.scaleBand().range([0, svg_height]);
var nameValue = function (d) { return nameScale(nameCalc(d)); };

// global variable to store the meme we're currently on
var current_index = 0;

var started = false;

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
		benchmarked_mentions: +d.benchmarked_index,
		tweet_id: d.twitter_id
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

	// for each meme, push its tweet id to array
	var tweet_ids = [];
	function findTweetIds (d) {
		for (var i in d) {
			var tweet_id = d[i].values[0].tweet_id;
			tweet_ids.push(tweet_id);
		}
	}
	
	// run findPeaks function on our dataset
	findPeaks(data);

	// sort memes by peak time
	data.sort(function (a, b) { return a.peakTime - b.peakTime; });
	
	// run getTweetId function on our dataset
	findTweetIds(data);

	// set domain for x scale and name scale now that we have dataset ready to go
	xScale.domain(d3.extent(dataset, x));
	nameScale.domain(data.map(function (d) { return d.key; }));

	// height of a joyplot is overlap % times the height of svg divided by number of names
	var areaChartHeight = (1 + overlap) * (svg_height / nameScale.domain().length);

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
			return svg_container_height - margin.bottom + 'px';
	})
		.style('top', function () {
			return margin.top - nameScale.bandwidth() + 'px';
	});

	// create a step for each joyplot that's the height of the joyplot w/o the overlap
  function createSteps() {
    var number_of_steps = data.length;
  	var counter = 0;
  	while (counter < number_of_steps) {
  		d3.select('.scroll__text')
  			.append('div')
  			.attr('class', 'step')
  			.style('top', function () {
  				return nameScale.bandwidth() * (counter + 1) + (nameScale.bandwidth() * overlap) + 'px';
  			});

    counter++;
    }
  }

  createSteps();

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
		return svg_container_height + 'px';
  	});

	var graphic = container.select('.scroll__graphic');
	graphic.style('height', windowHeight + 'px');

	var text = container.select('.scroll__text');
	var step = text.selectAll('.step');

	// initialize the scrollama
	var scroller = scrollama();

  //work in progress
  function handleResize() {
    windowHeight = window.innerHeight;
    windowWidth = window.innerWidth;
    width = windowWidth * .8;
    left_margin = windowWidth * .1;

    step.style('height', '120px');

    d3.select('.joyplot-container')
        .style('width', width)
      .select('svg')
        .attr('width', width);

    xScale.range([0, width]);
    xAxis = d3.axisBottom(xScale)
							.tickFormat(d3.timeFormat('%b'))
							.tickSizeOuter([0]);

    fixed_axis_svg.select('.x-axis')
                  .call(xAxis);

    graphic.style('height', windowHeight + 'px')

    graphic.select('svg')
           .select('g')
           .style('width', width)
           .attr('transform', 'translate(' + left_margin + ',' + 20 + ')');
    
	  
	var values = getValues(current_index);

    createAnnotations(current_index, values.nameNoSpace, values.peakMentions, values.peakTime);

    scroller.resize();
  }

	// generic window resize listener event - need to make
	// scrollama event handlers
	function handleStepEnter (response) {
		// response = { element, direction, index }
		// remove previous annotation and previous tweet

		if (started) {
			d3.selectAll('.annotation-group').remove();

			previous_tweet = d3.select('.current-tweet');

			d3.select('#tweet-storage')
				.append(function() {
						return previous_tweet.node();
				});
		} else {
			started = true;
		}

		// set some variables
		var index, direction;

		// not in use right now
		direction = response.direction;
        
        index = response.index;
		current_index = index;
		
		var values = getValues(index);

		// moves cute little red circle
		d3.select('.date-circle')
			.attr('cx', xScale(values.peakTime));

		// change to current meme name
		graphic.select('.meme-name')
			.text(values.name);

		// change to current meme peak month
		graphic.select('.month')
			.text(month_full_text(values.peakTime));

		// set opacity for all joyplots to .1, and then set the opacity for the joyplot we're on to 1
		d3.select('g.names')
			.selectAll('g')
			.attr('opacity', '1')
			.filter(function () {
			var className = 'name--' + values.nameNoSpace;
			if (d3.select(this).attr('class') == className) {
				return false;
			} else {
				return true;
			}
		})
			.attr('opacity', '.1');

		// create annotations
		createAnnotations(index, values.nameNoSpace, values.peakMentions, values.peakTime);
		
		// create tweets
		grabTweet(index);
		// if peak time is past halfway through year, move meme image/title. need to update to make sense for all screen sizes
		setMemeLocationSize(values.peakTime);
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
		d3.select('g.names')
			.selectAll('g')
			.attr('opacity', '.1');

		graphic.classed('is-fixed', false);
		graphic.classed('is-bottom', response.direction === 'down');
        d3.selectAll('.peak-annotation').remove();
	}

	function init () {
		// 1. force a resize on load to ensure proper dimensions are sent to scrollama
		handleResize();
		// 2. setup the scroller passing options
		// this will also initialize trigger observations
		// 3. bind scrollama event handlers (this can be chained like below)
		
		var screenWidth = screen.width;
		var windowWidth = window.innerWidth;
		var offsetPct;
		
		if (screenWidth < 763 || windowWidth < 763) {
			offsetPct = .9;
		} else {
			offsetPct = .8;
		}
		scroller.setup({
			container: '#scroll',
			graphic: '.scroll__graphic',
			text: '.scroll__text',
			step: '.scroll__text .step',
			debug: false,
			offset: offsetPct
		})
			.onStepEnter(handleStepEnter)
			.onContainerEnter(handleContainerEnter)
			.onContainerExit(handleContainerExit);
		// setup resize event

    window.addEventListener('resize', handleResize);
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
	d3.selectAll('.change-data-button')
		.on('click', function () {
			d3.selectAll('.change-data-button').classed('change-data-button-selected', false)
		
			var thisButton = d3.select(this);
		
			thisButton.classed('change-data-button-selected', true);
		
			var buttonIdentifier = thisButton.attr('id');
			var benchmarked;
			if (buttonIdentifier == 'change-button-not-benchmarked') {
				benchmarked = false;
			} else {
				benchmarked = true;
			}
			changeData(benchmarked);
			
			var values = getValues(current_index);

			createAnnotations(current_index, values.nameNoSpace, values.peakMentions, values.peakTime);
		});


	// create annotations
	function createAnnotations (index, name, peakMentions, peakTime) {
		// remove any existing annotations
        
        d3.selectAll('.peak-annotation').remove();
		
		//use this to determine triangle location. since month 7 is starting point 
		//for when tweet is on left side, offset that to be month 1
		var peakMonth = month_numerical(peakTime);
		var monthOffset = peakMonth;
		if (peakMonth >= 7) {
			monthOffset = peakMonth - 6;
		}
		// annotation is 100px wide. triangle is 14px wide. 6 months total. 
		// 6 * 14 = 84. then there can be 1px between triange location, so 
		// 84 + 14 = 98. 1px offset on either side to make 100px.
		var annotationWidth = 100;
		var triangleWidth = 14;
		var endsOffset = 8;
		
		var triangleOffset = endsOffset + (triangleWidth * (monthOffset - 1));
        
        d3.select('.joyplot-container')
          .append('div')
			.attr('class', 'peak-annotation')
			.style('position', 'absolute')
			.style('top', margin.top + (nameScale.bandwidth() * (index)) + yScale(peakMentions) - 35 + 'px')
			.style('left', xScale(peakTime) - triangleOffset - 7 + 'px')
			.text('Index of ' + peakMentions)
			.transition()
			.delay(3000);
		
		d3.select('.peak-annotation')
		  .append('div')
		  .attr('class', 'annotation-triangle')
		  .style('left', triangleOffset + 'px');
	
	}

	function createAllTweets() {
		var tweetNumber = tweet_ids.length;
		var percentageIncrement = 100 / tweetNumber;

		for (i in tweet_ids) {
			tweet_storage = d3.select('#tweet-storage');
			var id = 'tweet-' + i;
			tweet_storage.append('div').attr('id', id);
			twttr.widgets.createTweet(
	        tweet_ids[i], document.getElementById(id), {
	            conversation : 'none',    // or all
	            cards        : 'visible',  // or visible
	            linkColor    : '#cc0000', // default is blue
	            theme        : 'light'    // or dark
	        }
			);

			indexPlusOne = parseInt(i) + 1;
			d3.select('.loading-percentage').text(Math.round(indexPlusOne * percentageIncrement));

		}
	}

	createAllTweets();

	function grabTweet(index) {
		var id = '#tweet-' + index;

		var cached_tweet = d3.select(id);

		var visible_tweet = d3.select('#tweet')
							  .append(function() {
									return cached_tweet.node();
							   })
							  .attr('class', 'current-tweet');
		
		/*
		var thisTweet = document.getElementById("twitter-widget-" + index);
		var thisTweetBody = null;
		
		if (thisTweet) {
			thisTweetBody = thisTweet.contentDocument;
		}
		
		console.log(thisTweetBody);
		*/
		
		var thisTweet = d3.select("#twitter-widget-" + index);
		thisTweet.style('min-width', '200px');
		thisTweet.style('max-width', '1000px');
		thisTweet.style('height', '300px');
		thisTweet.style('width', '300px');
		

		sizeTweet(visible_tweet);

	}

	function sizeTweet(tweet) {
		twitterWidgetWidth = parseInt(tweet.style('width'), 10);
		twitterWidgetHeight = parseInt(tweet.style('height'), 10);
		var twitterWidgetRatio = twitterWidgetWidth / twitterWidgetHeight;

		tweetContainer = d3.select('#tweet');
		tweetContainerWidth = parseInt(tweetContainer.style('width'), 10);
		tweetContainerHeight = parseInt(tweetContainer.style('height'), 10);
		
		var screenHeight = window.innerHeight;
		var bigScreenTweetHeight = screenHeight * .3;
		var smallScreenTweetHeight = screenHeight * .1;
		
		var bigScreenHeightRatio = bigScreenTweetHeight / twitterWidgetHeight;
		var smallScreenHeightRatio = smallScreenTweetHeight / twitterWidgetHeight;
		
		
		var screenWidth = screen.width;
		var windowWidth = window.innerWidth;
		if (screenWidth < 763 || windowWidth < 763) {
			tweet.style('width', twitterWidgetWidth * smallScreenHeightRatio +  "px");
		} else {
			if (twitterWidgetWidth * bigScreenHeightRatio < windowWidth * .3) {
				tweet.style('width', twitterWidgetWidth * bigScreenHeightRatio +  "px");
			} else {
				tweet.style('width', windowWidth * .3 + "px");
			}
		}
		
	}


	// update data from benchmarked to non-benchmarked
	function changeData (benchmarked) {
		// update y function to look at benchmarked_mentions instead of normal mentions
		if (benchmarked) {
			y = function (d) { return d.benchmarked_mentions; };
			yScale.domain([0, d3.max(dataset, function (d) {
				return d.benchmarked_mentions;
			})]);

		} else {
			y = function (d) { return d.mentions; };
			yScale.domain([0, d3.max(dataset, function (d) {
				return d.mentions;
			})]);
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
		//xScale.domain(d3.extent(dataset, x));
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
        
        var svg = d3.select('.joyplot-container')
                .select('svg')
                .attr('viewBox', '0, 0, ' + width + ", " + svg_container_height)
                .attr('width', '100%');
	}
    
    function getValues(index) {
		var name, nameNoSpace, peakTime, peakMentions;

		name = data[index].key;
		nameNoSpace = cleanString(name);

		peakTime = data[index].peakTime;
		peakMentions = data[index].peakMentions;
        
        var values = {name: name, nameNoSpace: nameNoSpace, peakTime: peakTime, peakMentions: peakMentions};
        
        return values;
        
    }
	
	function setMemeLocationSize(peakTime) {
		
		var screenWidth = screen.width;
		var windowWidth = window.innerWidth;
		var memeNameContainer = graphic.select('.meme-name-container');
		var tweetContainer = graphic.select('#tweet')
		
		if (screenWidth < 763 || windowWidth < 763) {
			memeNameContainer.style('left', '15%');
			memeNameContainer.style('max-width', '70%');
			
			var memeNameHeight = parseInt(graphic.select('.meme-name-container').style('height'), 10);
			var memeNameOffset = parseInt(graphic.select('.meme-name-container').style('top'), 10);
			var tweetHeight = memeNameHeight + memeNameOffset;

			tweetContainer.style('left', '15%');
			tweetContainer.style('top', tweetHeight + 'px');
		} else {
			var peakMonth = month_numerical(peakTime);
			if (peakMonth >= 7) {
				tweetContainer.style('left', '15%');
				memeNameContainer.style('left', '55%');
			} else if (peakMonth < 7) {
				tweetContainer.style('left', '55%');
				memeNameContainer.style('left', '15%');
			}
			memeNameContainer.style('max-width', '30%');
			memeNameContainer.style('top', '10%');
			
			tweetContainer.style('top', '10%');
			
			
			
		}
	}
});
