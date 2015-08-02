
$(function () {
	var table = $('#items');
	var tbody = $('#items tbody');
	var items = {};
	var regexFilter = null;
	var tabs = [];
	var config = {};
	var market = {};
	var autoTimerInterval = null;

	var currencyTypes = {
		chrome: 1.0,
		alteration: (5/4),
		jeweller: (5/2),
		chance: (5/2),
		chisel: (25/4),
		fusing: (9/1),
		alchemy: (10/1),
		scouring: (10/1),
		blessed: (14/1),
		chaos: (19/1),
		regal: (19/1),
		gcp: (28/1),
		exalted: (56/1),
		eternal: (288/1)
	};

	var currencyCodes = {
		chrome: "chrome",
		alteration: "alt",
		jeweller: "jorb",
		chance: "chance",
		chisel: "chisel",
		fusing: "fus",
		alchemy: "alch",
		scouring: "scour",
		blessed: "borb",
		chaos: "c",
		regal: "reg",
		gcp: "gcp",
		exalted: "ex",
		eternal: "et"
	};

	var rarityTypes = [
		"Normal",
		"Magic",
		"Rare",
		"Unique",
		"Currency",
		"Quest"
	];

	function loadJSON(text) {
		try {
			return JSON.parse(text);
		} catch (e) {
			console.log(e);
		}
	}

	if ('config' in localStorage) {
		config = loadJSON(localStorage.config);
		console.log("Loaded config", config);
	}

	if ('market' in localStorage) {
		market = loadJSON(localStorage.market);
		console.log("Loaded market", market);
	}

	config.tabs = config.tabs || null;

	if (config.tabs) {
		config.tabs = Object.keys(config.tabs).length ? config.tabs : null;
	}

	market = market || {};

	function currencyToChromes(item) {
		var sum = 0.0;

		$.each(currencyTypes, function (currency, ratio) {
			item.filter('.currency-' + currency).each(function (i, node) {
				var text = $(node).text().replace(/[^0-9\.]/, '').trim();
				var count = Number(text);

				sum += count * ratio;
			});
		});

		return sum;
	}

	var sortedCurrency = [];

	$.each(currencyTypes, function (currency, ratio) {
		if (currency === 'eternal') {
			return;
		}

		sortedCurrency.push(currency);
	});

	sortedCurrency.sort(function (a, b) {
		return Number(currencyTypes[b]) - Number(currencyTypes[a]);
	});

	console.log("Sorted currency", sortedCurrency);

	function formatChromes(x) {
		var i, type, ratio, count;
		var price = {};

		x = Math.round(x);

		for (i=0; i < sortedCurrency.length; i++) {
			type = sortedCurrency[i];
			ratio = currencyTypes[type];
			count = Math.floor(x / ratio);

			if (count > 0) {
				x -= (count * ratio);

				if ('type' in price) {
					price[type] += count;
				} else {
					price[type] = count;
				}
			}

			if (x <= 0) {
				break;
			}
		}

		x = Math.floor(x);

		if (x > 0) {


			if ('chrome' in price) {
				price.chrome += x;
			} else {
				price.chrome = x;
			}

			x = 0;
		}

		return price;
	}

	function getCachedPrice(name) {
		name = String(name).trim().toLowerCase();

		if (!(name in market)) {
			return 0.0;
		}

		return market[name].avg;
	}

	// Refresh item prices every 30 minutes
	var marketCacheTime = 1000 * 60 * 30;

	function searchMarket(name, f) {
		var now = Date.now();
		name = String(name).trim().toLowerCase();

		if (name.length <= 0) {
			return;
		}

		if (name in market) {
			var cache = market[name];
			var distribute = (Math.random() - 0.5) * marketCacheTime * 0.5;

			if ((now - cache.then) < (marketCacheTime + distribute)) {
				f(cache);
				return;
			}
		}

		console.log("Searching market", name);

		$.ajax({
			url: "http://poe.trade/search",
			data: {
				name: name,
				league: $('#league').val()
				//online: "x"
			},
			success: function (response) {
				var doc = $.parseHTML(response);
				var total = 0.0;
				var count = 0;
				var avg = 0.0;

				$(doc).find('.item').each(function (i, tr) {
					var price = currencyToChromes($(tr).find('.currency'));

					if (price <= 0) {
						return;
					}

					total += price;
					count++;
				});

				if (count > 0) {
					avg = total / count;
				}

				market[name] = {
					avg: avg,
					count: count,
					total: total,
					then: Date.now()
				};

				localStorage.market = JSON.stringify(market);
				f(market[name]);
			}
		});
	}

	function addItemData(item) {
		var key = item.name || item.typeLine;

		if (!(key in items)) {
			items[key] = [];
		}

		items[key].push(item);
	}

	function refreshTable() {
		var sorted = [];

		$.each(items, function (type, list) {
			if (!hasMatching(list)) {
				return;
			}

			sorted.push(list);
		});

		sorted.sort(function (a, b) {
			var pa = getCachedPrice(a[0].name || a[0].typeLine);
			var pb = getCachedPrice(b[0].name || b[0].typeLine);
			return pb - pa;
		});

		tbody.empty();

		for (var i=0; i < sorted.length; i++) {
			addRow(sorted[i]);
		}
	}

	function addRow(list) {
		var tr, fullName;
		var item = list[0];
		var type = item.typeLine;

		if (item.name === item.typeLine) {
			fullName = type;
		} else {
			fullName = String(item.name) + " " + String(item.typeLine);
		}

		var rarity = String(rarityTypes[item.frameType]);

		tr = $('<tr/>').data('items', list);

		tr.append($('<td/>')
			.append('<input type="checkbox">')
		);

		tr.append($('<td/>')
			.append($('<img class="icon">').attr('src', item.icon))
			.append($('<span class="item"/>')
				.text(appendQuantity(fullName, list.length))
				.addClass(rarity.toLowerCase())
			)
		);

		var estimate = $('<td></td>').text('');
		tr.append(estimate);

		if (rarity === 'Unique' || rarity === 'Currency' || rarity === 'Rare' || rarity === 'Quest') {
			searchMarket(item.name || item.typeLine, function (result) {
				var price = formatChromes(result.avg);

				appendCurrency(estimate, price);

			});
		}

		tr.append($('<td></td>').text(''));

		tbody.append(tr);
	}

	function appendCurrency(node, price) {
		var i, type;

		for (i=0; i < sortedCurrency.length; i++) {
			type = sortedCurrency[i];

			if (!(type in price)) {
				continue;
			}

			node.append($('<span></span>')
				.text(price[type])
				.addClass('currency-' + String(type))
			);
		}
	}

	function appendQuantity(str, qty) {
		if (qty <= 1) {
			return String(str);
		}

		return String(str) + " (" + String(qty) + ")";
	}

	function checkFilter(item) {
		var fullName;

		if (config.tabs && !config.tabs[item.tab]) {
			return false;
		}

		if (item.name === item.typeLine) {
			fullName = item.name;
		} else {
			fullName = String(item.name) + " " + String(item.typeLine);
		}

		if (regexFilter && !regexFilter.test(fullName)) {
			return false;
		}

		return true;
	}

	function hasMatching(list) {
		for (var i=0; i < list.length; i++) {
			if (checkFilter(list[i])) {
				return true;
			}
		}

		return false;
	}

	function refreshStash(f) {
		tbody.empty();
		items = {};

		$('#publish').prop('disabled', true);

		tbody.append(
			$('<tr class="status"/>').append(
				$('<td colspan="4"/>').append(
					$('<div class="alert alert-success">Refreshing...</div>')
				)
			)
		);

		refreshTab(0, f);
	}

	function checkStashResponse(response) {
		if (!response || !response.tabs || response.tabs.length <= 0) {
			return false;
		}

		return true;
	}

	function refreshTab(tabIndex, f) {
		$.ajax({
			url: "https://www.pathofexile.com/character-window/get-stash-items",
			data: {
				league: $('#league').val(),
				tabs: 1,
				tabIndex: tabIndex
			},
			success: function (response) {
				var tabID;

				if (!checkStashResponse(response)) {
					finishStashRefresh(f);
					return;
				}

				tabs = response.tabs;
				tabID = null;

				$.each(response.tabs, function (i, tab) {
					if (tab.selected) {
						tabID = tab.i;
						return false;
					}
				});

				if (tabID <= 0) {
					console.log("Response contains no stash tab");
					return;
				}

				$.each(response.items, function (i, item) {
					item.tab = item.tab || tabID;
					item.icon = item.icon || "";

					if (item.icon.indexOf("://") < 0) {
						item.icon = "https://p7p4m6s5.ssl.hwcdn.net" + item.icon;
					}

					addItemData(item);
				});

				refreshTab(tabIndex + 1, f);
			},
			error: function (jqXHR, textStatus, errorThrown) {
				console.log(jqXHR.responseText);
				console.log(textStatus + ': ' + errorThrown);
			}
		});
	}

	function finishStashRefresh(f) {
		console.log("Finish stash refresh", items);

		$('#publish').prop('disabled', false);

		refreshTable();
		updateStashTabCheckboxes();

		if (tabs.length <= 0) {
			showLogin();
			return;
		}

		if (f) {
			f();
		}
	}

	function saveConfig() {
		config.tabs = {};

		config.thread = String($('#thread').val()).trim();
		config.autoRefresh = String($('#autorefresh').val()).trim();
		config.autoPoke = String($('#autopoke').val()).trim();
		config.template = String($('#template').val());

		$('#tabs label').each(function (i, node) {
			var input = $(node).find('input');
			var index = input.data('index');
			config.tabs[index] = input.is(':checked') || false;
		});

		writeConfig();
	}

	function writeConfig() {
		localStorage.config = JSON.stringify(config);
		console.log("Save config", config);
	}

	function addConfigSaver(selector, key) {
		$(selector).change(function () {
			var value = String($(selector).val()).trim();

			if (value === config[key]) {
				return;
			}

			saveConfig();
		});
	}

	function updateConfig() {
		$('#thread').val(config.thread || "");
		$('#autorefresh').val(config.autoRefresh || "0");
		$('#autopoke').val(config.autoPoke || "0");
		$('#autopoke-url').val(config.autoPokeURL || "");
		$('#league').val(config.league);
		$('#template').val(config.template || "");
		updateStashTabCheckboxes();
		updateCurrencyConfig();
	}

	function updateStashTabCheckboxes() {
		console.log("Updating stash tab checkboxes", tabs, config.tabs);
		$('#tabs').empty();

		$.each(tabs, function (i, tab) {
			if (tab.hidden) {
				return;
			}

			$('#tabs').append(
				$('<label class="checkbox-inline"/>')
					.text(tab.n)
					.prepend(
						$('<input type="checkbox">')
							.data('index', i)
							.prop('checked', config.tabs ? config.tabs[i] : true)
							.change(function (e) {
								saveConfig();
								refreshTable();
							})
					)
			);
		});
	}

	function updateCurrencyConfig() {
		$('#currency').empty();

		$.each(sortedCurrency, function (i, currency) {

			$('#currency').append($('<div class="checkbox"/>')
				.append($('<label/>')
					.text(currency)
					.prepend($('<input type="checkbox">'))
				)
			);
		});
	}

	function showLogin() {
		var div, iframe, button;

		div = $('<div id="login"/>');
		iframe = $('<iframe src="https://www.pathofexile.com/login">');
		button = $('<button>Cancel Login</button>').attr({
			class: 'btn btn-danger',
			id: 'login-cancel'
		}).click(function () {
			div.detach();
		}).prepend('&nbsp;').prepend('<span class="glyphicon glyphicon-remove"/>');

		iframe.load(function () {
			if (iframe.contents().find('.loggedInStatus').length) {
				div.detach();
				refreshStash();
			}
		});

		div.append(iframe, button);
		$('body').append(div);
	}

	function updateFilter() {
		var text = $('#filter').val().trim();

		if (text.length) {
			regexFilter = new RegExp(text, 'gi');
		} else {
			regexFilter = null;
		}

		refreshTable();
	}

	function getQueryArg(url, key) {
		key = key.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
		var pattern = new RegExp("[\\?&]" + key + "=([^&#]*)");
		var results = regex.exec(url);
		if (!results) { return ""; }
		return decodeURIComponent(results[1].replace(/\+/g, " "));
	}

	function updatePoke() {
		if (!config.autoPoke) {
			return;
		}

		if (!config.autoPokeURL) {
			fetchPokeURL(function () {
				if (!config.autoPokeURL) {
					return;
				}

				updateConfig();
				writeConfig();
				updatePoke();
			});

			return;
		}

		$.post(config.autoPokeURL, function (response) {
			console.log("marked as online?");
		});
	}

	function fetchMessageList(f) {
		$.get('https://www.pathofexile.com/private-messages', function (response) {
			var doc = $.parseHTML(response);
			var list = $(doc).find('a[href^="/private-messages/view/folder/inbox/id/"]');
			f(list);
		}).fail(f);
	}

	function fetchMessage(id, f) {
		id = String(id).replace('/', '').trim();
		var url = "https://www.pathofexile.com/private-messages/view/folder/inbox/id/" + id;

		$.get(url, function (response) {
			var doc = $.parseHTML(response);
			var posts = [];

			$(doc).find('.message-details').each(function (i, node) {
				posts.push($(node).text().trim());
			});

			f(posts);
		}).fail(f);
	}

	function fetchPokeURL(f) {
		var pattern = /http:\/\/control.poe.xyz.is\/([^\s]+)/i;

		fetchMessageList(function (list) {
			list.each(function (i, message) {
				if ($(message).text().trim() !== 'You are very welcome.') {
					return;
				}

				var messageID = $(message).attr('href')
					.replace('private-messages/view/folder/inbox/id', '')
					.replace('/', '')
					.trim();

				fetchMessage(messageID, function (posts) {
					$.each(posts, function (i, text) {
						var match = text.match(pattern);

						if (match && match.length) {
							config.autoPokeURL = match[0];
							f();
							return false;
						}
					});
				});
			});
		});
	}

	function fetchThread(threadID, f) {
		$.get(
			"https://www.pathofexile.com/forum/edit-thread/" + String(threadID),
			function (response) {
				var doc = $.parseHTML(response);
				var token = $(doc).find('[name=forum_thread]').val();

				if (!token) {
					console.log("Missing token from edit-thread");
					return;
				}

				var title = $(doc).find('[name=title]').val();

				if (title.length <= 0) {
					title = "My Shop";
				}

				f(token, title);
			}
		);
	}

	function updateForumThread() {
		var threadID = String($('#thread').val())
			.replace('https://www.pathofexile.com/forum/view-thread/', '')
			.replace('/', '')
			.trim();

		if (threadID.length <= 0) {
			return;
		}

		$('#publish').prop('disabled', true);
		$('#publish-status').text('Grabbing thread...').addClass('label-warning');

		fetchThread(threadID, function (token, title) {
			var content = String(config.template || "");

			if (content.indexOf("[items]") < 0) {
				content += "\n[items]\n";
			}

			content = content.replace('[items]', generateListing());
			$('#publish-status').text('Updating thread...');

			$.ajax({
				url: "https://www.pathofexile.com/forum/edit-thread/" + String(threadID),
				type: 'POST',
				data: {
					forum_thread: token,
					title: title,
					content: content,
					submit: "Submit"
				},
				success: function (response) {
					finishUpdateForumThread();
				}
			});
		});

		console.log("updating forum thread", threadID);
	}

	function finishUpdateForumThread() {
		var date = new Date();
		var time = date.toLocaleTimeString(navigator.language, {
			hour: '2-digit',
			minute:'2-digit'
		});

		$('#publish').prop('disabled', false);

		$('#publish-status')
			.text('Last updated at ' + time)
			.removeClass('label-warning')
			.addClass('label-success');
	}

	function generateListingBlock(rarity) {
		var listing = "\n[spoiler=" + rarityTypes[rarity] + "]\n";
		var count = 0;

		rarity = Number(rarity);

		$.each(items, function (type, list) {
			if (Number(list[0].frameType) !== rarity) {
				return;
			}

			$.each(list, function (i, item) {
				if (config.tabs && !config.tabs[item.tab]) {
					return;
				}

				listing += '[linkItem location="Stash' + String(Number(item.tab) + 1) + '" ';
				listing += 'league="' + String(item.league) + '" ';
				listing += 'x="' + String(item.x) + '" ';
				listing += 'y="' + String(item.y) + '" ';
				listing += ']\n';

				count++;
			});
		});

		if (count <= 0) {
			return "";
		}

		listing += "[/spoiler]\n";

		return listing;
	}

	function generateListing() {
		var listing = "";

		$.each(rarityTypes, function (rarity, label) {
			listing += generateListingBlock(rarity);
			listing = listing.trim();
		});

		listing += "\n--------------------------\n";
		listing += "Generated with [url=https://github.com/poetools/poedex]poedex[/url]\n";

		return listing;
	}

	addConfigSaver('#thread', 'thread');
	addConfigSaver('#autorefresh', 'autoRefresh');
	addConfigSaver('#autopoke', 'autoPoke');
	addConfigSaver('#autopoke-url', 'autoPokeURL');
	addConfigSaver('#template', 'template');

	$('#league').change(function () {
		config.league = $('#league').val();
		market = {};
		config.tabs = null;
		tabs = null;
		refreshStash();
	});

	$('#filter').change(function (e) {
		updateFilter();
	});

	$('#refresh').click(function (e) {
		refreshStash();
	});

	$('#checkall').change(function () {
		$('#items input[type=checkbox]').prop('checked', $('#checkall').is(':checked'));
	});

	$('#publish').click(function () {
		if ($('#publish').prop('disabled')) {
			return;
		}

		updateForumThread();
		updatePoke();
	});

	$('#debug').click(function () {
		require('nw.gui').Window.get().showDevTools();
	});

	$('#reload').click(function () {
		window.location = 'index.html';
	});

	function getClickedRow(e) {
		var node = $(e.target);

		if (node.parent('input,textarea,.btn').length) {
			return;
		}

		e.preventDefault();
		return node.parent('tr');
	}

	var checkState = null;

	$('#items').mousedown(function (e) {
		var tr = getClickedRow(e);
		if (!tr) { return; }
		var checkbox = tr.find('input[type=checkbox]');
		checkState = !checkbox.is(':checked');
		checkbox.prop('checked', checkState);
	}).mousemove(function (e) {
		if (checkState === null) {
			return;
		}

		var tr = getClickedRow(e);
		if (!tr) { return; }
		var checkbox = tr.find('input[type=checkbox]');
		checkbox.prop('checked', checkState);
	}).mouseup(function (e) {
		checkState = null;
	});

	$('#items').mousemove(function (e) {
		var node = $(e.target);
		var tr = node.parents('tr');

		$('#hover-stats').empty();

		if (tr.length <= 0) {
			$('#hover-stats').hide();
			return;
		}

		var td = tr.find('td:nth-child(2)');
		var list = tr.data('items');

		if (!list || list.length <= 0) {
			$('#hover-stats').hide();
			return;
		}

		var item = list[0];

		item.implicitMods = item.implicitMods || [];
		item.explicitMods = item.explicitMods || [];

		if (item.implicitMods.length <= 0 && item.explicitMods.length <= 0) {
			$('#hover-stats').hide();
			return;
		}

		$.each(item.implicitMods, function (i, str) {
			$('#hover-stats').append($('<div class="mod"/>').text(str));
		});

		if (item.implicitMods.length) {
			$('#hover-stats').append('<div class="line"/>');
		}

		$.each(item.explicitMods, function (i, str) {
			$('#hover-stats').append($('<div class="mod"/>').text(str));
		});

		var pos = td.offset();

		$('#hover-stats').offset({
			left: pos.left + td.width() - $('#hover-stats').width(),
			top: pos.top + td.height() / 2 - $('#hover-stats').height() / 2
		}).show();
	});

	$(window).mousemove(function (e) {
		var node = $(e.target);

		if (node.is('#hover-stats') || node.parents('#hover-stats').length) {
			return;
		}

		if (node.parents('#items').length <= 0) {
			$('#hover-stats').hide();
		}
	});

	updateConfig();
	refreshStash();

	function autoTimer(selector, key, f) {
		var now = Date.now();
		var minutes = $(selector).val();

		if (minutes <= 0) {
			return;
		}

		var then = config[key];

		if (then <= 0) {
			config[key] = now;
			f();
			return;
		}

		var span = now - then;

		if (span >= (minutes * 60 * 1000)) {
			config[key] = now;
			f();
		}
	}

	autoTimerInterval = setInterval(function () {
		var now = Date.now();

		autoTimer('#autorefresh', 'lastThreadUpdate', function () {
			refreshStash(function () {
				updateForumThread();
			});
		});

		autoTimer('#autoPoke', 'lastPokeUpdate', function () {
			updatePoke();
		});
	}, 1000 * 30);
});
