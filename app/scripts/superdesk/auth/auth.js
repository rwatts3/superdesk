define([
    'angular',
    'require',
    'angular-route',
    './auth-service',
    './session-service',
    './allypy-auth-service',
    './login-modal-directive'
], function(angular, require) {
    'use strict';

    /**
     * Expire session on 401 server response
     */
    AuthExpiredInterceptor.$inject = ['session', '$injector', '$rootScope'];
    function AuthExpiredInterceptor(session, $injector, $rootScope) {
        return {
            response: function(response) {
                if (response.status === 401) {
                    session.expire();
                    $rootScope.forcedLogout = true;
                    return session.getIdentity().then(function() {
                        $rootScope.forcedLogout = false;
                        var $http = $injector.get('$http');
                        $http.defaults.headers.common.Authorization = session.token;
                        response.config.headers.Authorization = session.token;
                        return $http(response.config);
                    });
                }

                return response;
            }
        };
    }

    angular.module('superdesk.auth', ['superdesk', 'ngRoute'])
        .service('auth', require('./auth-service'))
        .service('session', require('./session-service'))
        .service('authAdapter', require('./allypy-auth-service'))
        .directive('sdLoginModal', require('./login-modal-directive'))
        .config(['$httpProvider', function($httpProvider) {
            $httpProvider.interceptors.push(AuthExpiredInterceptor);
        }])

        // watch session token, identity
        .run(['$rootScope', '$route', '$location', '$http', '$window', 'session',
        function($rootScope, $route, $location, $http, $window, session) {

            $rootScope.logout = function() {
                session.expire();
                $window.location.replace('/'); // reset page for new user
            };

            // populate current user
            $rootScope.$watch(function() {
                return session.identity;
            }, function (identity) {
                $rootScope.currentUser = session.identity;
            });

            // set auth header
            $rootScope.$watch(function() {
                return session.token;
            }, function(token) {
                if (token) {
                    $http.defaults.headers.common.Authorization = token;
                } else {
                    delete $http.defaults.headers.common.Authorization;
                }
            });

            // prevent routing when there is no token
            $rootScope.$on('$locationChangeStart', function (e) {
                if (!session.token) {
                    session.getIdentity().then(function() {
                        $http.defaults.headers.common.Authorization = session.token;
                        $route.reload();
                    });
                    e.preventDefault();
                }
            });
        }]);
});
