/**
 * Main application code.
 */

var SERVER_URL = 'https://uvalert.koterpillar.com';

var LOCATION_MAX_AGE = 60 * 60 * 24; // seconds

var INFO_TEXT = [
  "This program is free software: you can redistribute it and/or modify",
  "it under the terms of the GNU General Public License as published by",
  "the Free Software Foundation, either version 3 of the License, or",
  "(at your option) any later version.",
  "",
  "This program is distributed in the hope that it will be useful,",
  "but WITHOUT ANY WARRANTY; without even the implied warranty of",
  "MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the",
  "GNU General Public License for more details.",
  "",
  "You should have received a copy of the GNU General Public License",
  "along with this program.  If not, see <http://www.gnu.org/licenses/>.",
  "",
  "Australian UV observations courtesy of ARPANSA.",
  "",
  "USA UV observations courtesy of EPA.",
  ""
].join(" ").replace("\n\n");

var ajax = require('ajax');
var Settings = require('settings');
var UI = require('ui');

function pass() {}

function logError(where) {
  return function () {
    var errorString = Array.prototype.slice.call(arguments).join(", ");
    console.log("Error: " + where + ": " + errorString);
  };
}

function getLocationList(callback) {
  var locations = Settings.option('locations');
  if (locations && locations.timestamp &&
      locations.timestamp >= (new Date()).getTime() - LOCATION_MAX_AGE) {
    callback(locations.data);
  } else {
    ajax(
      {
        url: SERVER_URL + '/locations',
        type: 'json'
      },
      function (data, status_, request) {
        locations = {
          data: data,
          timestamp: (new Date()).getTime()
        };
        Settings.option('locations', locations);
        getLocationList(callback);
      },
      logError("getLocationList")
    );
  }
}

function getLocation(callback) {
  var loc = Settings.option('location');
  if (typeof(loc) == 'string') {
    // Old location, find it in the location list and replace
    getLocationList(function (locations) {
      for (var i = 0; i < locations.length; i++) {
        if (locations[i].city == loc) {
          callback(locations[i]);
        }
      }
      callback(null);
    });
  } else {
    callback(loc);
  }
}

function locationTitle(loc) {
  if (typeof(loc) == 'string') {
    // Old location, it will be reset once selected via menu
    return loc;
  }
  return loc.city + ", " + loc.region;
}

function setLocation(value) {
  Settings.option('location', value);
  updateLocationSubscription();
  main.subtitle(locationTitle(value));
}

function locationEqual(loc1, loc2) {
  return loc1.country == loc2.country &&
    loc1.region == loc2.region &&
    loc1.city == loc2.city;
}

function updateLocationSubscription() {
  getLocation(function (loc) {
    if (!loc) {
      return;
    }
    var locTopic = "v2-" + loc.country + "-" + loc.region + "-" + loc.city;
    Pebble.timelineSubscriptions(
      function (topics) {
        var haveSubscription = false;

        for (var i = 0; i < topics.length; i++) {
          if (topics[i] == locTopic) {
            haveSubscription = true;
          } else {
            Pebble.timelineUnsubscribe(
                topics[i], pass, logError('timelineUnsubscribe'));
          }
        }

        if (!haveSubscription) {
          Pebble.timelineSubscribe(locTopic, pass, logError('timelineSubscribe'));
        }
      },
      logError('timelineSubscriptions')
    );
  });
}

var main = new UI.Card({
  title: "UV Alert",
  subtitle: "",
  body: "Use the timeline to view alerts.",
  action: {
    select: 'images/select-location.png',
    up: 'images/info.png'
  }
});

function selectLocation() {
  getLocationList(function (locations) {
    getLocation(function (selected) {
      var selectedIndex = 0; // default to first element
      var items = locations.map(function (loc, i) {
        if (locationEqual(loc, selected)) {
          selectedIndex = i;
        }
        return {
          title: loc.city,
          subtitle: loc.region + ", " + loc.country
        };
      });
      var locationSelect = new UI.Menu({
        sections: [{
          title: "Select Location",
          items: items
        }]
      });
      locationSelect.selection(0, selectedIndex);
      locationSelect.on('select', function (e) {
        var loc = locations[e.itemIndex];
        setLocation(loc);
        locationSelect.hide();
      });
      locationSelect.show();
    });
  });
}

main.on('click', 'select', selectLocation);

main.on('click', 'up', function () {
  var dataInfo = new UI.Card({
    title: "UV Alert for Pebble",
    body: INFO_TEXT,
    scrollable: true
  });

  dataInfo.on('select', function () {
    // TODO: open the info URL on the phone
  });

  dataInfo.show();
});

main.show();

getLocation(function (loc) {
  if (!loc) {
    // Default location
    loc = {
      city: "Melbourne",
      region: "Victoria",
      country: "Australia"
    };
    setLocation(loc);
  }

  // Ensure the subscriptions are in sync with the location
  updateLocationSubscription();

  main.subtitle(locationTitle(loc));
});
