/**
 * IXA CSM - Modern Consent Manager
 * Version: 1.3.0
 * Enhanced with premium visual design and effects
 */

const IXA_CSM = (function() {
    // Private variables
    let config = {};
    let manageConfig = {};
    let consentState = {};
    let csmElement = null;
    let managePanel = null;
    let overlay = null;
    
    // Constants
    const STORAGE_KEY = 'ixa_csm_consent';
    const DEFAULT_CONFIG = {
        title: 'Cookie Consent',
        text: 'This site uses cookies to improve your experience.',
        policyLink: { visible: true, url: '#' },
        termsLink: { visible: true, url: '#' },
        buttons: {
            accept: { visible: false, text: 'Accept' },
            acceptAll: { visible: true, text: 'Accept All' },
            denyAll: { visible: true, text: 'Deny All' },
            manage: { visible: true, text: 'Manage' }
        },
        theme: { mode: 'auto' },
        delay: { time: 0 },
        watermark: { visible: true }
    };
    
    // Initialize the consent manager
    function init() {
        // Load configuration first
        loadConfig()
            .then(() => {
                // Check if consent is already given
                const savedConsent = localStorage.getItem(STORAGE_KEY);
                if (savedConsent) {
                    try {
                        consentState = JSON.parse(savedConsent);
                        console.log('IXA CSM: Loaded saved consent', consentState);
                        applyConsent();
                    } catch (error) {
                        console.error('IXA CSM: Error parsing saved consent', error);
                        showConsentUI();
                    }
                } else {
                    // Create and show the consent UI after the specified delay
                    setTimeout(() => {
                        createConsentUI();
                        showConsentUI();
                    }, config.delay.time * 1000);
                }
            })
            .catch(error => {
                console.error('IXA CSM: Error loading configuration', error);
            });
    }
    
    // Load configuration from XML
    function loadConfig() {
        return new Promise((resolve, reject) => {
            const configPath = window.IXA_CSM_CONFIG?.configPath || 'config.xml';
            
            fetch(configPath)
                .then(response => response.text())
                .then(xmlText => {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                    
                    // Parse main configuration
                    parseMainConfig(xmlDoc);
                    
                    // Load management configuration
                    const managePath = getXmlValue(xmlDoc, 'manage') || 'manage.xml';
                    return fetch(managePath);
                })
                .then(response => response.text())
                .then(xmlText => {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                    
                    // Parse management configuration
                    parseManageConfig(xmlDoc);
                    resolve();
                })
                .catch(error => {
                    console.error('IXA CSM: Error loading XML configuration', error);
                    // Use default configuration
                    config = DEFAULT_CONFIG;
                    resolve();
                });
        });
    }
    
    // Parse main configuration from XML
    function parseMainConfig(xmlDoc) {
        config = {
            title: getXmlValue(xmlDoc, 'title') || DEFAULT_CONFIG.title,
            text: getXmlValue(xmlDoc, 'text') || DEFAULT_CONFIG.text,
            policyLink: {
                visible: getXmlAttribute(xmlDoc, 'policy-link', 'visible') === 'true',
                url: getXmlValue(xmlDoc, 'policy-link') || '#'
            },
            termsLink: {
                visible: getXmlAttribute(xmlDoc, 'terms-link', 'visible') === 'true',
                url: getXmlValue(xmlDoc, 'terms-link') || '#'
            },
            buttons: {
                accept: {
                    visible: getXmlAttribute(xmlDoc, 'buttons acc', 'visible') === 'true',
                    text: getXmlValue(xmlDoc, 'buttons acc') || 'Accept'
                },
                acceptAll: {
                    visible: getXmlAttribute(xmlDoc, 'buttons all', 'visible') === 'true',
                    text: getXmlValue(xmlDoc, 'buttons all') || 'Accept All'
                },
                denyAll: {
                    visible: getXmlAttribute(xmlDoc, 'buttons den', 'visible') === 'true',
                    text: getXmlValue(xmlDoc, 'buttons den') || 'Deny All'
                },
                manage: {
                    visible: getXmlAttribute(xmlDoc, 'buttons man', 'visible') === 'true',
                    text: getXmlValue(xmlDoc, 'buttons man') || 'Manage'
                }
            },
            theme: {
                mode: getXmlAttribute(xmlDoc, 'theme', 'mode') || 'auto'
            },
            delay: {
                time: parseInt(getXmlAttribute(xmlDoc, 'delay', 'time') || '0', 10)
            },
            watermark: {
                visible: getXmlAttribute(xmlDoc, 'watermark', 'visible') !== 'false' // Default to true if not specified
            }
        };
    }
    
    // Parse management configuration from XML
    function parseManageConfig(xmlDoc) {
        const categories = xmlDoc.querySelectorAll('category');
        manageConfig.categories = [];
        
        categories.forEach(category => {
            const categoryObj = {
                id: category.getAttribute('id') || generateId(),
                title: getElementValue(category, 'title'),
                description: getElementValue(category, 'description'),
                required: category.getAttribute('required') === 'true',
                services: []
            };
            
            const services = category.querySelectorAll('service');
            services.forEach(service => {
                const serviceObj = {
                    id: service.getAttribute('id') || generateId(),
                    title: getElementValue(service, 'title'),
                    description: getElementValue(service, 'description'),
                    provider: getElementValue(service, 'provider'),
                    link: getElementValue(service, 'link'),
                    custom: getElementValue(service, 'custom')
                };
                
                categoryObj.services.push(serviceObj);
                
                // Initialize consent state only if not already set
                if (consentState[categoryObj.id] === undefined) {
                    consentState[categoryObj.id] = categoryObj.required;
                }
                if (consentState[serviceObj.id] === undefined) {
                    consentState[serviceObj.id] = categoryObj.required;
                }
            });
            
            manageConfig.categories.push(categoryObj);
        });
    }
    
    // Helper function to get XML element value
    function getXmlValue(xmlDoc, path) {
        const element = xmlDoc.querySelector(path);
        return element ? element.textContent : null;
    }
    
    // Helper function to get XML element attribute
    function getXmlAttribute(xmlDoc, path, attribute) {
        const element = xmlDoc.querySelector(path);
        return element ? element.getAttribute(attribute) : null;
    }
    
    // Helper function to get element value from parent
    function getElementValue(parent, tagName) {
        const element = parent.querySelector(tagName);
        return element ? element.textContent : '';
    }
    
    // Generate a random ID
    function generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Create the consent UI
    function createConsentUI() {
        // Create main container
        csmElement = document.createElement('div');
        csmElement.id = 'ixa-csm';
        csmElement.className = `ixa-csm ixa-theme-${config.theme.mode}`;
        
        // Create content
        const content = document.createElement('div');
        content.className = 'ixa-csm-content';
        
        // Add close button (X)
        const closeButton = document.createElement('button');
        closeButton.className = 'ixa-csm-close';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => {
            hideConsentUI(); // Just hide without saving
        });
        content.appendChild(closeButton);
        
        // Add title
        const title = document.createElement('h2');
        title.className = 'ixa-csm-title';
        title.textContent = config.title;
        content.appendChild(title);
        
        // Add text
        const text = document.createElement('p');
        text.className = 'ixa-csm-text';
        text.textContent = config.text;
        content.appendChild(text);
        
        // Add links
        const links = document.createElement('div');
        links.className = 'ixa-csm-links';
        
        if (config.policyLink.visible) {
            const policyLink = document.createElement('a');
            policyLink.href = config.policyLink.url;
            policyLink.textContent = 'Privacy Policy';
            policyLink.className = 'ixa-csm-link';
            links.appendChild(policyLink);
        }
        
        if (config.termsLink.visible) {
            const termsLink = document.createElement('a');
            termsLink.href = config.termsLink.url;
            termsLink.textContent = 'Terms of Service';
            termsLink.className = 'ixa-csm-link';
            links.appendChild(termsLink);
        }
        
        content.appendChild(links);
        
        // Add buttons
        const buttons = document.createElement('div');
        buttons.className = 'ixa-csm-buttons';
        
        if (config.buttons.accept.visible) {
            const acceptButton = document.createElement('button');
            acceptButton.className = 'ixa-csm-button ixa-csm-button-accept';
            acceptButton.textContent = config.buttons.accept.text;
            acceptButton.addEventListener('click', () => {
                acceptConsent('necessary');
            });
            buttons.appendChild(acceptButton);
        }
        
        if (config.buttons.acceptAll.visible) {
            const acceptAllButton = document.createElement('button');
            acceptAllButton.className = 'ixa-csm-button ixa-csm-button-accept-all';
            acceptAllButton.textContent = config.buttons.acceptAll.text;
            acceptAllButton.addEventListener('click', () => {
                acceptConsent('all');
            });
            buttons.appendChild(acceptAllButton);
        }
        
        if (config.buttons.denyAll.visible) {
            const denyAllButton = document.createElement('button');
            denyAllButton.className = 'ixa-csm-button ixa-csm-button-deny-all';
            denyAllButton.textContent = config.buttons.denyAll.text;
            denyAllButton.addEventListener('click', () => {
                acceptConsent('none');
            });
            buttons.appendChild(denyAllButton);
        }
        
        if (config.buttons.manage.visible) {
            const manageButton = document.createElement('button');
            manageButton.className = 'ixa-csm-button ixa-csm-button-manage';
            manageButton.textContent = config.buttons.manage.text;
            manageButton.addEventListener('click', () => {
                showManagePanel();
            });
            buttons.appendChild(manageButton);
        }
        
        content.appendChild(buttons);
        
        // Add watermark if enabled
        if (config.watermark.visible) {
            const watermark = document.createElement('div');
            watermark.className = 'ixa-csm-watermark';
            watermark.innerHTML = 'Powered by <span>Ixavence</span>';
            content.appendChild(watermark);
        }
        
        csmElement.appendChild(content);
        
        // Create overlay
        overlay = document.createElement('div');
        overlay.className = 'ixa-csm-overlay';
        overlay.addEventListener('click', () => {
            hideManagePanel();
        });
        document.body.appendChild(overlay);
        
        // Create management panel
        createManagePanel();
        
        // Add to document
        document.body.appendChild(csmElement);
    }
    
    // Create the management panel
    function createManagePanel() {
        managePanel = document.createElement('div');
        managePanel.className = `ixa-csm-manage-panel ixa-theme-${config.theme.mode}`;
        
        // Add header
        const header = document.createElement('div');
        header.className = 'ixa-csm-manage-header';
        
        const title = document.createElement('h2');
        title.textContent = 'Privacy Preferences';
        header.appendChild(title);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'ixa-csm-manage-close';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => {
            hideManagePanel();
        });
        header.appendChild(closeButton);
        
        managePanel.appendChild(header);
        
        // Add categories
        const categories = document.createElement('div');
        categories.className = 'ixa-csm-manage-categories';
        
        manageConfig.categories.forEach((category, index) => {
            const categoryElement = document.createElement('div');
            categoryElement.className = 'ixa-csm-category';
            if (index > 0) {
                categoryElement.classList.add('collapsed');
            }
            
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'ixa-csm-category-header';
            categoryHeader.addEventListener('click', () => {
                toggleCategory(categoryElement);
            });
            
            const categoryTitle = document.createElement('h3');
            categoryTitle.textContent = category.title;
            categoryHeader.appendChild(categoryTitle);
            
            const categoryToggle = document.createElement('label');
            categoryToggle.className = 'ixa-csm-toggle';
            categoryToggle.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent category toggle when clicking the switch
            });
            
            const toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.checked = consentState[category.id] || false;
            toggleInput.disabled = category.required;
            toggleInput.dataset.id = category.id;
            toggleInput.addEventListener('change', (e) => {
                const checked = e.target.checked;
                consentState[category.id] = checked;
                
                // Update all services in this category
                const serviceToggles = categoryElement.querySelectorAll(`.ixa-csm-service-toggle input[data-category="${category.id}"]`);
                serviceToggles.forEach(toggle => {
                    if (!toggle.disabled) {
                        toggle.checked = checked;
                        consentState[toggle.dataset.id] = checked;
                    }
                });
            });
            
            const toggleSlider = document.createElement('span');
            toggleSlider.className = 'ixa-csm-slider';
            
            categoryToggle.appendChild(toggleInput);
            categoryToggle.appendChild(toggleSlider);
            categoryHeader.appendChild(categoryToggle);
            
            categoryElement.appendChild(categoryHeader);
            
            // Create category content container
            const categoryContent = document.createElement('div');
            categoryContent.className = 'ixa-csm-category-content';
            
            const categoryDescription = document.createElement('p');
            categoryDescription.textContent = category.description;
            categoryContent.appendChild(categoryDescription);
            
            // Add services
            if (category.services.length > 0) {
                const services = document.createElement('div');
                services.className = 'ixa-csm-services';
                
                category.services.forEach(service => {
                    const serviceElement = document.createElement('div');
                    serviceElement.className = 'ixa-csm-service';
                    
                    const serviceHeader = document.createElement('div');
                    serviceHeader.className = 'ixa-csm-service-header';
                    
                    const serviceTitle = document.createElement('h4');
                    serviceTitle.textContent = service.title;
                    serviceHeader.appendChild(serviceTitle);
                    
                    const serviceToggle = document.createElement('label');
                    serviceToggle.className = 'ixa-csm-toggle ixa-csm-service-toggle';
                    
                    const toggleInput = document.createElement('input');
                    toggleInput.type = 'checkbox';
                    toggleInput.checked = consentState[service.id] || false;
                    toggleInput.disabled = category.required;
                    toggleInput.dataset.id = service.id;
                    toggleInput.dataset.category = category.id;
                    toggleInput.addEventListener('change', (e) => {
                        consentState[service.id] = e.target.checked;
                    });
                    
                    const toggleSlider = document.createElement('span');
                    toggleSlider.className = 'ixa-csm-slider';
                    
                    serviceToggle.appendChild(toggleInput);
                    serviceToggle.appendChild(toggleSlider);
                    serviceHeader.appendChild(serviceToggle);
                    
                    serviceElement.appendChild(serviceHeader);
                    
                    const serviceDescription = document.createElement('p');
                    serviceDescription.textContent = service.description;
                    serviceElement.appendChild(serviceDescription);
                    
                    if (service.provider) {
                        const serviceProvider = document.createElement('p');
                        serviceProvider.className = 'ixa-csm-service-provider';
                        serviceProvider.textContent = `Provider: ${service.provider}`;
                        serviceElement.appendChild(serviceProvider);
                    }
                    
                    if (service.link) {
                        const serviceLink = document.createElement('a');
                        serviceLink.href = service.link;
                        serviceLink.className = 'ixa-csm-service-link';
                        serviceLink.textContent = 'Learn more';
                        serviceLink.target = '_blank';
                        serviceElement.appendChild(serviceLink);
                    }
                    
                    services.appendChild(serviceElement);
                });
                
                categoryContent.appendChild(services);
            }
            
            categoryElement.appendChild(categoryContent);
            categories.appendChild(categoryElement);
        });
        
        managePanel.appendChild(categories);
        
        // Add footer with save button
        const footer = document.createElement('div');
        footer.className = 'ixa-csm-manage-footer';
        
        const saveButton = document.createElement('button');
        saveButton.className = 'ixa-csm-button ixa-csm-button-save';
        saveButton.textContent = 'Save Preferences';
        saveButton.addEventListener('click', () => {
            saveConsent();
            hideManagePanel();
        });
        
        footer.appendChild(saveButton);
        
        // Add watermark to footer if enabled
        if (config.watermark.visible) {
            const watermark = document.createElement('div');
            watermark.className = 'ixa-csm-watermark ixa-csm-watermark-footer';
            watermark.innerHTML = 'Powered by <span>Ixavence</span>';
            footer.appendChild(watermark);
        }
        
        managePanel.appendChild(footer);
        
        document.body.appendChild(managePanel);
    }
    
    // Toggle category collapse/expand
    function toggleCategory(categoryElement) {
        categoryElement.classList.toggle('collapsed');
    }
    
    // Show the consent UI
    function showConsentUI() {
        if (!csmElement) {
            createConsentUI();
        }
        
        if (csmElement) {
            csmElement.classList.add('ixa-csm-visible');
        }
    }
    
    // Hide the consent UI
    function hideConsentUI() {
        if (csmElement) {
            csmElement.classList.remove('ixa-csm-visible');
        }
    }
    
    // Show the management panel
    function showManagePanel() {
        if (managePanel && overlay) {
            overlay.classList.add('visible');
            setTimeout(() => {
                managePanel.classList.add('visible');
            }, 50);
        }
    }
    
    // Hide the management panel
    function hideManagePanel() {
        if (managePanel && overlay) {
            managePanel.classList.remove('visible');
            setTimeout(() => {
                overlay.classList.remove('visible');
            }, 300);
        }
    }
    
    // Accept consent
    function acceptConsent(type) {
        if (type === 'all') {
            // Accept all
            manageConfig.categories.forEach(category => {
                consentState[category.id] = true;
                
                category.services.forEach(service => {
                    consentState[service.id] = true;
                });
            });
        } else if (type === 'none') {
            // Deny all except required
            manageConfig.categories.forEach(category => {
                consentState[category.id] = category.required;
                
                category.services.forEach(service => {
                    consentState[service.id] = category.required;
                });
            });
        } else if (type === 'necessary') {
            // Accept only necessary
            manageConfig.categories.forEach(category => {
                if (category.id === 'necessary' || category.required) {
                    consentState[category.id] = true;
                    
                    category.services.forEach(service => {
                        consentState[service.id] = true;
                    });
                } else {
                    consentState[category.id] = false;
                    
                    category.services.forEach(service => {
                        consentState[service.id] = false;
                    });
                }
            });
        }
        
        saveConsent();
    }
    
    // Save consent
    function saveConsent() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(consentState));
            console.log('IXA CSM: Saved consent state', consentState);
            applyConsent();
            hideConsentUI();
        } catch (error) {
            console.error('IXA CSM: Error saving consent state', error);
        }
    }
    
    // Apply consent
    function applyConsent() {
        // Execute custom scripts based on consent
        manageConfig.categories.forEach(category => {
            if (consentState[category.id]) {
                category.services.forEach(service => {
                    if (consentState[service.id] && service.custom) {
                        try {
                            // Replace the eval with proper script injection
                            const scriptContent = service.custom;
                            
                            // For script tags that need to be added to head
                            if (scriptContent.includes('<script') || scriptContent.includes('script>')) {
                                // Create a temporary div to parse HTML
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = scriptContent;
                                
                                // Find and append all script elements
                                const scriptElements = tempDiv.querySelectorAll('script');
                                scriptElements.forEach(script => {
                                    const newScript = document.createElement('script');
                                    
                                    // Copy attributes
                                    Array.from(script.attributes).forEach(attr => {
                                        newScript.setAttribute(attr.name, attr.value);
                                    });
                                    
                                    // Copy content
                                    newScript.textContent = script.textContent;
                                    
                                    // Add to document
                                    document.head.appendChild(newScript);
                                });
                            } else {
                                // For inline JavaScript that doesn't include script tags
                                const script = document.createElement('script');
                                script.textContent = scriptContent;
                                document.head.appendChild(script);
                            }
                        } catch (error) {
                            console.error('IXA CSM: Error executing custom script', error);
                        }
                    }
                }); 
            }
        });
    }
    
    // Reset consent
    function reset() {
        localStorage.removeItem(STORAGE_KEY);
        consentState = {};
        
        // Reload configuration and show consent UI
        loadConfig()
            .then(() => {
                if (csmElement) {
                    document.body.removeChild(csmElement);
                    csmElement = null;
                }
                if (managePanel) {
                    document.body.removeChild(managePanel);
                    managePanel = null;
                }
                if (overlay) {
                    document.body.removeChild(overlay);
                    overlay = null;
                }
                createConsentUI();
                showConsentUI();
            })
            .catch(error => {
                console.error('IXA CSM: Error loading configuration', error);
            });
    }
    
    // Public API
    return {
        init: init,
        reset: reset,
        getConsentState: () => consentState,
        showConsentManager: () => {
            showManagePanel();
        }
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', IXA_CSM.init);