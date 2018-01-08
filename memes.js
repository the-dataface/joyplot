
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
} else if (screenWidth < 1000 || windowWidth < 1000) {
	var svg_container_height = 6000;
} else {
	var svg_container_height = 8000;
}

var svg_height = svg_container_height - margin.top - margin.bottom;
var joyplot_width = d3.select('.joyplot-container').node().offsetWidth;

// create svg with margins
var svg = d3.select('.joyplot-container')
			.append('svg')
        		.attr('viewBox', '0, 0, ' + joyplot_width + ", " + svg_container_height)
				.attr('width', joyplot_width)
				.attr('height', svg_container_height)
        		.attr("preserveAspectRatio", "none")
			.append('g')
			  	.attr('transform', 'translate(0,' + margin.top + ')');

// create separate svg for fixed x-axis that will be in scrollytelling
var fixed_axis_svg = d3.select('.scroll__graphic')
					   .select('.axis-container')
					   .append('svg')
					 	.attr('width', '100%')
					 	.attr('height', '100px')
					   .append('g');

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
var day_numerical = d3.timeFormat('%d');

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
d3.csv('https://the-dataface.github.io/data/memes-2017/meme_tweets.csv', function (error, first_dataset) {

	// import data from csv
	d3.csv('https://the-dataface.github.io/data/memes-2017/meme_interest_data_stacked.csv', rowConverter, function (error, dataset) {
		if (error) { throw error; }

		var benchmarked = false;
		var clicked = false;

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
		
		function mergeData(set1, set2) {
			for (var i in set1) {
				for (var j in set2) {
					if (set1[i].meme == set2[j].key) {
						set2[j].description = set1[i].meme_description;
						set2[j].link = set1[i].know_your_meme_link;
						break;
					} 
				}
			}
		}
		

		// run findPeaks function on our dataset
		findPeaks(data);
		
		mergeData(first_dataset, data);

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
				return svg_container_height - margin.bottom - margin.top + 'px';
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
				})
				.style('height', '100px');

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
		var windowHeight = window.innerHeight;
		var windowWidth = window.innerWidth;
		var width;
		var leftMargin;
		var axisTopMargin;
		var svgContainerHeight;

		if (windowWidth > 763) {
			width = windowWidth * .7;
			leftMargin = windowWidth * .15;
			axisTopMargin = 20;
			svgContainerHeight = 11000;
		} else {
			width = windowWidth * .9;
			leftMargin = windowWidth * .05;
			//axisTopMargin = windowHeight * .6;
			axisTopMargin = 20;
			svgContainerHeight = 4000;
		}

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
					.attr('transform', 'translate(0, ' + axisTopMargin + ')')
			   .select('g')
					.attr('transform', 'translate(' + leftMargin + ',' + 20 + ')');


		var values = getValues(current_index);

		createAnnotations(current_index, values.nameNoSpace, values.peakMentions, values.peakTime, false);
		  
		//changeData(benchmarked);

		scroller.resize();
	  }

		// generic window resize listener event - need to make
		// scrollama event handlers
		function handleStepEnter (response) {
			// response = { element, direction, index }
			// remove previous annotation and previous tweet
			
			d3.select('#tweet').style('display', 'none');
			clicked = false;
			
			if (started) {
				d3.selectAll('.annotation-group').remove();

				previous_tweet = d3.select('.current-tweet').classed('current-tweet', false);

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
			
			graphic.select('.meme-description')
				.text(values.description);
			
			graphic.select('#website-link')
				.on('click', function() {
					window.open(values.link);
				});

			// change to current meme peak month
			graphic.select('.month')
				.text(month_full_text(values.peakTime));

			// set opacity for all joyplots to .1, and then set the opacity for the joyplot we're on to 1
			d3.select('g.names')
				.selectAll('g')
				.attr('opacity', '.1');

			var className = 'name--' + values.nameNoSpace;
			var thisJoyplot = d3.select('.' + className);
			thisJoyplot.attr('opacity', '1');

			d3.selectAll('.benchmark-line').remove();

			if (benchmarked) {
				var cashKey;
				
				for (i in data) {
					if (data[i].key == 'Cash Me Outside') {
						cashKey = i;
						break;
					}
				}
				thisJoyplot.append('path')
					 .attr('class', 'benchmark-line')
					 .datum(data[cashKey].values)
					 .attr('d', line);
			}

			// create annotations
			createAnnotations(index, values.nameNoSpace, values.peakMentions, values.peakTime, false);

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
			
			d3.selectAll('.benchmark-line').remove();
			d3.selectAll('.benchmark-annotation').remove();
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
				var thisButton = d3.select(this);
				
				if (!thisButton.classed('change-data-button-selected')) {
					
					d3.selectAll('.change-data-button').classed('change-data-button-selected', false)

					thisButton.classed('change-data-button-selected', true);

					var buttonIdentifier = thisButton.attr('id');
					if (buttonIdentifier == 'change-button-not-benchmarked') {
						benchmarked = false;
					} else {
						benchmarked = true;
					}
					changeData(benchmarked);

					var values = getValues(current_index);

					createAnnotations(current_index, values.nameNoSpace, values.peakMentions, values.peakTime, true);
				}
			
			});

		d3.select('#example-link')
			.on('mouseover', function () {
				var thisTweet = d3.select('#tweet');
				thisTweet.style('display', 'block');
			})
			.on('mouseout', function() {
				if (!clicked) {
					var thisTweet = d3.select('#tweet');
					thisTweet.style('display', 'none');
				}
			})
			.on('touchstart', function () {
				var thisTweet = d3.select('#tweet');
				thisTweet.style('display', 'block');
			})
			.on('touchend', function() {
				if (!clicked) {
					var thisTweet = d3.select('#tweet');
					thisTweet.style('display', 'none');
				}
			})
			.on('click', function() {
				if (!clicked) {
					var thisTweet = d3.select('#tweet');
					thisTweet.style('display', 'block');
					clicked = true;
				} else {
					var thisTweet = d3.select('#tweet');
					thisTweet.style('display', 'none');
					clicked = false;
				}
			});

		// create annotations
		function createAnnotations (index, name, peakMentions, peakTime, buttonPressed) {
			// remove any existing annotations

			d3.selectAll('.peak-annotation').remove();
			d3.selectAll('.benchmark-annotation').remove();

			if (buttonPressed) {
				var delay = 1300;
			} else {
				var delay = 0;
			}

			var annotation = d3.select('.joyplot-container')
							   .append('div')
								.attr('class', 'peak-annotation')
								.style('position', 'absolute')
								.style('visibility', 'hidden')
								.text('Index of ' + peakMentions);

			//use this to determine triangle location. since month 7 is starting point
			//for when tweet is on left side, offset that to be month 1
			var peakMonth = month_numerical(peakTime);
			var percentMonth = (peakMonth - 1) / 11;

			var annotationWidth = parseInt(d3.select('.peak-annotation').style('width'), 10);
			var annotationHeight = parseInt(d3.select('.peak-annotation').style('height'), 10);

			var triangleWidth = 14;
			var offsetAnnotationWidth = annotationWidth - (triangleWidth * 2);
			var triangleOffset = triangleWidth + (offsetAnnotationWidth * percentMonth);
			
			if (peakMonth == 12) {
				annotation.style('width', '90px');
			}

			annotationWidth = parseInt(d3.select('.peak-annotation').style('width'), 10);

			annotation.style('top', margin.top + (nameScale.bandwidth() * (index)) + yScale(peakMentions) - 					annotationHeight - 10 + 'px')
					  .style('left', xScale(peakTime) - triangleOffset - 7 + 'px');
			

			d3.select('.peak-annotation')
			  .append('div')
			  .attr('class', 'annotation-triangle')
			  .style('visibility', 'hidden')
			  .style('left', triangleOffset + 'px')
			  .style('top', annotationHeight - 6 + 'px');

			if (benchmarked && name !== 'CashMeOutside') {
				var cashKey;
				
				for (i in data) {
					console.log(data[i]);
					if (data[i].key == 'Cash Me Outside') {
						cashKey = i;
						break;
					}
				}
				var benchmarkValues = getValues(cashKey);
				
				d3.select('.joyplot-container')
				  .append('div')
					.attr('class', 'benchmark-annotation')
					.style('position', 'absolute')
					.text('Cash Me Outside benchmark')
					.style('top', margin.top + (nameScale.bandwidth() * (index)) + yScale(benchmarkValues.peakMentions) + 'px')
					.style('left', xScale(benchmarkValues.peakTime) + 'px')
					.style('visibility', 'hidden');

			}

			d3.select('.peak-annotation')
			  .transition()
			  .delay(delay)
			  .style('visibility', 'visible');

			d3.select('.annotation-triangle')
			  .transition()
			  .delay(delay)
			  .style('visibility', 'visible');

			d3.select('.benchmark-annotation')
			  .transition()
			  .delay(delay)
			  .style('visibility', 'visible');
		}

		function createAllTweets() {
			var tweetNumber = tweet_ids.length;
			//var percentageIncrement = 100 / tweetNumber;

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
				}).then(function(r) {
					d3.select(r).style('min-width', '0px');
					d3.select(r).style('max-width', '1000px');

					var windowWidth = window.innerWidth;
					var tweetWidth;

				});


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

			var thisTweet = d3.select("#twitter-widget-" + index);

			var windowWidth = window.innerWidth;
			var tweetWidth;

			if (windowWidth > 763) {
				tweetWidth = windowWidth * .2;
			} else {
				tweetWidth = windowWidth * .4;
			}

			thisTweet.style('width', tweetWidth + 'px');

			/*
			tweetWidth = parseInt(thisTweet.style('width'), 10);
			tweetHeight = parseInt(thisTweet.style('height'), 10);
			*/


			//var newTweetWidth = sizeTweet(tweetWidth, tweetHeight);

			//thisTweet.style('width', newTweetWidth + 'px');

		}

		function sizeTweet(w, h) {

			var windowWidth = window.innerWidth;

			if (windowWidth > 763) {

			} else {

			}

			/*var ratio = h / w;

			var screenHeight = window.innerHeight;
			var screenWidth = window.innerWidth;

			var targetWidth = screenWidth * .27;
			var maxHeight = screenHeight * .4

			if (targetWidth * ratio > maxHeight) {
				return screenWidth * .2;
			} else {
				return targetWidth;
			}
			*/

			//console.log(ratio + ',' + screenHeight + ',' + screenWidth + ',' + maxTweetHeight + ',' + maxTweetWidth + ',' + tweetWidth);

			/*
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
			*/

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

			d3.selectAll('.benchmark-line').remove();

			var values = getValues(current_index);
			var className = 'name--' + values.nameNoSpace;
			var thisJoyplot = d3.select('.' + className);

			if (benchmarked) {
				var cashKey;
				
				for (i in data) {
					if (data[i].key == 'Cash Me Outside') {
						cashKey = i;
						break;
					}
				}
	
				thisJoyplot.append('path')
					 .attr('class', 'benchmark-line')
					 .datum(data[cashKey].values)
					 .attr('d', line);
			}
			
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

			var width = parseInt(d3.select('.joyplot-container').style('width'), 10);

			var svg = d3.select('.joyplot-container')
					.select('svg')
					.attr('viewBox', '0, 0, ' + width + ", " + svg_container_height)
					.attr('width', '100%');
		}

		function getValues(index) {
			var name, nameNoSpace, peakTime, peakMentions, description, link;

			name = data[index].key;
			nameNoSpace = cleanString(name);

			peakTime = data[index].peakTime;
			peakMentions = data[index].peakMentions;
			
			description = data[index].description;
			link = data[index].link;

			var values = {name: name, nameNoSpace: nameNoSpace, peakTime: peakTime, peakMentions: peakMentions, description: description, link: link};

			return values;

		}

		function setMemeLocationSize(peakTime) {

			var peakMonth = month_numerical(peakTime);
			var firstHalf = true;
			if (peakMonth > 6) {
				firstHalf = false;
			}
			var windowWidth = window.innerWidth;
			var memeNameContainer = graphic.select('.meme-name-container');

			var memeNameHeight = parseInt(graphic.select('.meme-name-container').style('height'), 10);
			var memeNameOffset = windowHeight * .13;
			var tweetHeight = memeNameHeight + memeNameOffset;

		}
		
		var rankedData = [];
		function getTableArray(d) {
			for (i in d) {
				if (i < 50) {
					var name, rank, peakMentions, peakTime, day, month, timeOfMonth;
					name = d[i].meme;
					rank = d[i].rank;
					peakMentions = d[i].peak_index;
					peakTime = parseTime(d[i].peak_week);
				
					month = month_full_text(peakTime);
				
					day = day_numerical(peakTime);

					if (day < 10) {
						timeOfMonth = 'early ';
					} else if (day < 20) {
						timeOfMonth = 'mid ';
					} else {
						timeOfMonth = 'end of ';
					}

					var thisMeme = {name: name, rank:rank, peakMentions: peakMentions, month: month, timeOfMonth: timeOfMonth};
					rankedData.push(thisMeme);
					}
			}
			
		}

		getTableArray(first_dataset);
		rankedData.sort(function (a, b) { return a.rank - b.rank; });
		
		for (i in rankedData) {
			var memeName = rankedData[i].name;
			var memeRank = rankedData[i].rank;
			var memeMentions = rankedData[i].peakMentions;
			var memeMonth = rankedData[i].month;
			var memeTOM = rankedData[i].timeOfMonth;
				
			var tr = d3.select('.meme-table')
			  			.select('.table-body')
			  			.append('tr');
			
			var rank = tr.append('td').attr('class', 'table-rank').text(memeRank +  '.');
			
			var meme = tr.append('td')
						 .append('span')
							.attr('class', 'table-meme-name')
							.text(memeName + ' ')
						 .append('span')
							.attr('class', 'table-meme-date')
							.text('peaked ' + memeTOM + memeMonth);
			
			var searchIndex = tr.append('td')
									.attr('class', 'table-index')
								.append('div')
									.attr('class', 'table-bar')
									.style('width', memeMentions + '%')
								.append('span')
									.text(memeMentions);
		}
	});
});
