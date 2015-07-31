
$(function () {
	var table = $('#items');
	var tbody = $('#items tbody');
	var items = {};
	var regexFilter = null;
	var tabs = [];
	var config = {};
	var market = {};

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

	config.tabs = config.tabs || [];
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
				league: "Tempest"
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

		tr = $('<tr></tr>');

		tr.append($('<td></td>')
			.append('<input type="checkbox">')
		);

		tr.append($('<td></td>')
			.append($('<img class="icon">').attr('src', item.icon))
			.append($('<span></span>')
				.text(appendQuantity(fullName, list.length))
				.attr('class', rarity.toLowerCase())
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

		if (!config.tabs[item.tab]) {
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
			if (checkFilter(list[0])) {
				return true;
			}
		}

		return false;
	}

	function refreshStash() {
		tbody.empty();
		items = {};

		tbody.append(
			$('<tr class="status"></tr>').append(
				$('<td colspan="4"></td>').append(
					$('<div class="alert alert-success">Refreshing...</div>')
				)
			)
		);

		refreshTab(0);
	}

	function refreshTab(tabIndex) {
		$.ajax({
			url: "https://www.pathofexile.com/character-window/get-stash-items",
			data: {
				league: "Tempest",
				tabs: 1,
				tabIndex: tabIndex
			},
			success: function (response) {
				if (!response || !response.items) {
					finishStashRefresh();
					return;
				}

				response.tabs = response.tabs || [];
				tabs = response.tabs || tabs;

				var tabID = null;

				$.each(response.tabs, function (i, tab) {
					if (tab.selected) {
						tabID = tab.i;
						return false;
					}
				});

				if (config.tabs.length <= 0 && tabs.length) {
					config.tabs = [];

					$.each(tabs, function (key) {
						config.tabs[key] = 1;
					});

					updateTabs();
				}

				$.each(response.items, function (i, item) {
					item.tab = item.tab || tabID;
					item.icon = item.icon || "";

					if (item.icon.indexOf("://") < 0) {
						item.icon = "https://p7p4m6s5.ssl.hwcdn.net" + item.icon;
					}

					addItemData(item);
				});

				refreshTab(tabIndex + 1);
			}
		});
	}

	function saveConfig() {
		config.tabs = {};

		$('#tabs label').each(function (i, node) {
			var input = $(node).find('input');
			var index = input.data('index');
			config.tabs[index] = input.is(':checked') || false;
		});

		localStorage.config = JSON.stringify(config);
		console.log("Save config", config);
	}

	function finishStashRefresh() {
		refreshTable();
		updateTabs();

		if (tabs.length <= 0) {
			showLogin();
		}
	}

	function showLogin() {
		var div, iframe, button;

		div = $('<div id="login"></div>');
		iframe = $('<iframe src="https://www.pathofexile.com/login">');
		button = $('<button class="btn btn-block">Cancel</button>');

		iframe.load(function () {
			if (iframe.contents().find('.loggedInStatus').length) {
				div.detach();
				refreshStash();
			}
		});

		div.append(iframe, button);
		$('body').append(div);
	}

	function updateTabs() {
		$('#tabs').empty();

		$.each(tabs, function (i, tab) {
			if (tab.hidden) {
				return;
			}

			$('#tabs').append(
				$('<label class="checkbox-inline"></label>')
					.text(tab.n)
					.prepend(
						$('<input type="checkbox">')
							.data('index', i)
							.prop('checked', config.tabs[i])
							.change(function (e) {
								saveConfig();
								refreshTable();
							})
					)
			);
		});
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

	$('#filter').change(function (e) {
		tbody.empty();
		updateFilter();
	});

	$('#refresh').click(function (e) {
		refreshStash();
	});

	$('#checkall').change(function () {
		$('#items input[type=checkbox]').prop('checked', $('#checkall').is(':checked'));
	});

	refreshStash();
});
