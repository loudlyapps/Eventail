function getOptions(cb) {
    chrome.storage.sync.get({
        sensuApiHost: "",
        sensuApiPort: "",
        uchiwaHost: "",
        uchiwaPort: "",
        datacenter: ""
    }, function(items) {

        items.configured = (items.sensuApiHost == "" ||
                              items.sensuApiPort == "" ||
                              items.uchiwaHost == "" ||
                              items.uchiwaPort == "" ||
                              items.datacenter == "")? false: true;
        cb(items);
    });
}

function setOptions(items, cb) {
    chrome.storage.sync.set({
        sensuApiHost: items.sensuApiHost,
        sensuApiPort: items.sensuApiPort,
        uchiwaHost:   items.uchiwaHost,
        uchiwaPort:   items.uchiwaPort,
        datacenter:   items.datacenter
    }, function() {
        cb();
    });
}

function getEvents(callback) {
    getOptions(function(items) {
        if (items.configured) {
            $.ajax({
                dataType: 'json',
                url: items.sensuApiHost + ':' + items.sensuApiPort + '/events',
                success: function(data) {
                    callback(data, items);
                }
            });
        }
    });
}

function postResolve(client, check, callback) {
    getOptions(function(items) {
        if (items.configured) {
            $.ajax({
                method: 'post',
                url: items.sensuApiHost + ':' + items.sensuApiPort + '/resolve',
                data: JSON.stringify({'client': client, 'check': check}),
                contentType: 'application/json',
                success: function(data) {
                    callback(data);
                }
            });
        }
    });
}

function postRecheck(check, subscribe, callback) {
    getOptions(function(items) {
        if (items.configured) {
            reloadIcon();
            $.ajax({
                method: 'post',
                url: items.sensuApiHost + ':' + items.sensuApiPort + '/request',
                data: JSON.stringify({'check': check, "subscribers": subscribe }),
                contentType: 'application/json',
                success: function(data) {
                    callback(data);
                }
            });
        }
    });
}

function reloadIcon() {
    getEvents(setIconBadge);
}

function reloadPopup() {
    getEvents(setPopup);
    setFooter();
}

function setIconBadge(data, items) {

    var warn = 0;
    var crit = 0;
    for (i in data) {
        if (data[i].check.status == 2) { crit += 1; }
        if (data[i].check.status == 1) { warn += 1; }
    }

    color = (crit > 0 )? "#EA5443": "#F9BA46";

    if (data.length > 0) {
        chrome.browserAction.setBadgeText({text: data.length.toString()});
        chrome.browserAction.setBadgeBackgroundColor({color: color});
    } else {
        chrome.browserAction.setBadgeText({text: ""});
    }
}

function setPopup(data, items) {

    if (data.length == 0) {
        var str = "Alert does not have anything. System is a normal state.";
        $('#main').html(str);
    } else {
        $('main').html("");
        var d = {};
        for (i in data) {
            client = data[i].client;
            check  = data[i].check;
            if (client.name in d) {
            } else {
                d[client.name] = {
                    "check": [],
                    "address": client.address,
                    "subscriptions": client.subscriptions
                };
            }
            var item = {
                "name": client.name,
                "command": check.command,
                "check": check.name,
                "output": check.output,
                "status": check.status,
                "history": check.history,
                "subscribers": check.subscribers,
                "issued": check.issued,
                "history": check.history,
                "executed": check.executed,
                "id": data[i].id
            };
            d[client.name]["check"].push(item);
        }

        for (client in d) {

            // error message
            var body = $('<div class="panel-collapse collapse">');
            body.attr('id', client + '_body');

            var crit = 0;
            var warn = 0;
            for (error in d[client]["check"]) {
                var e = d[client]["check"][error];

                var check = $('<span class="label">');
                check
                    .addClass((e.status == 2)? 'label-danger': 'label-warning')
                    .text(e.check);

                var action = getAction(e, items);

                var message = $('<div>');
                message.html(e.output);

                var hr = $('<hr>');

                var dt = new Date((e.issued || e.executed) * 1000).toISOString();
                var issued = $('<div class="issued">');
                issued.append(
                    $('<abbr class="timeago">').attr('title', dt).text(dt)
                );

                var history = $('<div class="history">');
                history.append($('<span class="glyphicon glyphicon-bullhorn">'));
                for (i in e.history) {
                    history.append(
                        $('<span>')
                            .addClass('history_color_' + e.history[i])
                            .text("●")
                    );
                }

                var c = $('<div class="panel-body link">');
                c.append(action).append(message).append(check).append(hr).append(issued).append(history);


                body.append(c);
                if (e.status == 2) { crit += 1; }
                if (e.status == 1) { warn += 1; }
            }

            // header
            var panel = $('<div class="panel panel-default">');
            var title = $('<a>');
            title
                .attr({
                    'data-toggle': 'collapse',
                    'data-parent': '#main',
                    'href': '#' + client + '_body',
                    'id': 'id_' + client,
                    'data-placement': 'right',
                    'title': 'Address: ' + d[client].address
                })
                .text(client)
                .append(getClientInfo(e))
                .append(getCheckInfo(e))
                .append(getHeaderBadge(crit, warn))
                .append(getSubscriptions(d[client]))
                .appendTo($('<h4 class="panel-title">')).parent()
                .appendTo($('<div class="panel-heading">')).parent()
                .appendTo(panel);

            body.appendTo(panel);
            $('#main').append(panel);

            $('#id_' + client).tooltip();
        }
        $('abbr.timeago').timeago();
        $('.collapse').collapse();
    }
}

function getSubscriptions(c) {
    var subscriptions = $('<div>');
    for (i in c.subscriptions) {
        var labelColor = 0;
        var l = c.subscriptions[i];
        for (e in c.check) {
            var check = c.check[e];
            if (check.subscribers && check.subscribers.indexOf(l) >= 0) {
                if (labelColor == 0 && check.status == 1) {
                    labelColor = 1;
                } else {
                    labelColor = 2;
                }
            }
        }
        var label = ['label-success', 'label-warning', 'label-danger'];
        subscriptions.append(
            $('<div class="label" style="margin-left:3px">')
                .addClass(label[labelColor])
                .text(l)
        );
    }
    return subscriptions;
}

function getCheckInfo(e) {

}

function getClientInfo(e) {

}

function getAction(e, items) {
    var resolve =[items.uchiwaHost + ':' + items.uchiwaPort,
                  '#',
                  'client',
                  items.datacenter,
                  e.name + '?check=' + e.check].join('/');
    var uchiwa = [items.uchiwaHost + ':' + items.uchiwaPort,
                  '#',
                  'client',
                  items.datacenter,
                  e.name + '?check=' + e.check].join('/');

    var action = $('<div>').css('float', 'right');
    action
        .append(
            $('<a>')
                .append(
                    $('<span class="glyphicon glyphicon-ok">')
                        .attr('title', 'Resolve')
                )
                .css('cursor', 'pointer')
                .click(
                    function() {
                        postResolve(e.name, e.check, function(data) {
                            location.reload();
                        });

                    }
                )
        );

    action
        .append(
            $('<a>').attr({'href': uchiwa, 'target': '_blank'})
                .append(
                    $('<span class="glyphicon glyphicon-new-window">')
                        .attr('title', 'Open uchiwa page')
                )
        );
    if (e.check != 'keepalive') {
        action
            .append(
                $('<a>')
                    .append(
                        $('<span class="glyphicon glyphicon-flash">')
                            .attr('title', 'Recheck')
                    )
                    .css('cursor', 'pointer')
                    .click(
                        function() {
                            postRecheck(e.check, e.subscribers, function(data) {
                                location.reload();
                            });

                        }
                    )
            );
    }

    return action;
}

function getHeaderBadge(crit, warn) {
    var bgcolor = (crit > 0)? "#b94a48": "#f89406";
    var badge = $('<span class="badge pull-right">');
    badge
        .css('backgroundColor', bgcolor)
        .text(crit + warn);
    return badge;
}

function setFooter() {
    $.ajax({
        dataType: 'json',
        url: chrome.extension.getURL('/manifest.json'),
        success: function(data) {
            $('#footer').text(data.name + " Ver." + data.version);
        }
    });
}
