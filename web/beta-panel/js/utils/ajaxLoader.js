$(function() {
    /*
     * @function removes the page loader.
     */
    function showPage() {
        helpers.log('Showing dashboard page', helpers.LOG_TYPE.DEBUG);
        if ($('.loader').length > 0) {
            // Stop pace since we already have one loader.
            Pace.stop();
            $('.loader').fadeOut(3e2, function() {
                $('.loader').remove();
            });

            $('.main').fadeIn(2e2);
            helpers.log('Page shown', helpers.LOG_TYPE.DEBUG);
        }
    }

    /*
     * @function handles the loading of pages.
     *
     * @param {String} folder
     * @param {String} page
     */
    function loadPage(folder, page, href) {
        // Make sure the href isn't blank, then load the page.
        if (page !== '') {
            helpers.log('Starting ajax request for page: ' + folder + '/' + page, helpers.LOG_TYPE.DEBUG);
            // Start pace loading.
            if (href === undefined) {
                Pace.stop();
            } else {
            	Pace.restart();
            }

            // Clear all timers. This doesn't clear any global timers (intervals).
            helpers.clearTimers();
            // Remove all temp global functions.
            helpers.temp = {};

            // Load the page.
            $.ajax({
                cache: false,
                dataType: 'html',
                url: 'beta-panel/pages/' + folder + '/' + page,
                success: function(data) {
                    // Set the new page.
                    $('#page-content').html(data);
                    if (href !== undefined) {
                        // Set the current tab as active.
                        $.fn.dinamicMenu(href);
                        // Update URL.
                        history.pushState(null, '', '/beta-panel');
                    }
                    helpers.log('Completed ajax request for page: ' + folder + '/' + page, helpers.LOG_TYPE.DEBUG);
                },
                error: function(err) {
                    helpers.logError('Failed to load page (' + page + ') => ' + err.statusText, helpers.LOG_TYPE.FORCE);
                }
            });
        }
    }

	// Handles loading of tabs.
	$('.sidebar-menu a').on('click', function() {
        loadPage($(this).data('folder'), $(this).attr('href').substring(1), this.href);
	});

    // Export to API.
    $.showPage = showPage;
    $.loadPage = loadPage;
});
