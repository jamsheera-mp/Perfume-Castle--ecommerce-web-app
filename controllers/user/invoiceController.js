
const PDFDocument = require('pdfkit-table');
const fs = require('fs');
const path = require('path');
const Order = require('../../models/orderSchema')

class InvoiceGenerator {
    constructor(order, stream) {
        this.order = order;
        this.doc = new PDFDocument({ margin: 50, size: 'A4' });
        this.doc.pipe(stream);
    }

    async generateHeader() {
        try {
            const logoPath = path.join(process.cwd(),'public', 'uploads', 'logo', 'PCL_WL.jpg');
            
            // Check if file exists
            if (fs.existsSync(logoPath)) {
                this.doc.image(logoPath, 50, 45, { width: 50 });
            } else {
                console.warn('Logo file not found:', logoPath);
                // Continue without logo
            }
            
            this.doc
                .fillColor('#444444')
                .fontSize(20)
                .text('Perfume Castle', 110, 57)
                .fontSize(10)
                .text('Address: Calicut road,Valanchery',  110, 75)
                .fontSize(10)
                .text('Contact:9778452220')
                

        } catch (error) {
            console.error('Error loading logo:', error);
            // Continue without logo
        }
    }

    async generateCustomerInformation() {
        // Find the specific address from the array
        const addressDocument = this.order.address.parentAddressId;
        const specificAddress = addressDocument.address.find(addr =>
            addr._id.toString() === this.order.address.addressId.toString()
        );

        if (!specificAddress) {
            throw new Error('Selected address not found');
        }
        const customerTableData = {
            headers: ['INVOICE DETAILS', 'SHIPPING ADDRESS'],
            rows: [
                [
                    `Invoice Number: ${this.order.orderId}\n` +
                    `Date: ${formatDate(this.order.createdOn)}\n` +
                    `Status: ${this.order.status}\n` +
                    `Payment Method: ${this.order.paymentMethod}`,
                    
                    `${specificAddress.name}\n` +
                    `${specificAddress.landMark}\n` +
                    `${specificAddress.city}, ${specificAddress.district}\n` +
                    `${specificAddress.state} - ${specificAddress.pincode}\n` +
                    `Phone: ${specificAddress.phone}`
                ]
            ]
        };

        await this.doc.table(customerTableData, {
            prepareHeader: () => this.doc.font('Helvetica-Bold').fontSize(10),
            prepareRow: () => this.doc.font('Helvetica').fontSize(10),
            width: 500,
            x: 50,
            divider: {
                header: { disabled: false, width: 2, opacity: 1 },
                horizontal: { disabled: false, width: 1, opacity: 0.5 }
            }
        });

        this.doc.moveDown();
    }

    async generateInvoiceTable() {
        const tableData = {
            headers: ['Item', 'Description', 'Unit Price', 'Quantity', 'Total Price'],
            rows: this.order.orderedItems.map(item => [
                item.product.productName,
                item.product.description.substring(0, 30) + '...',
                formatCurrency(item.price),
                item.quantity.toString(),
                formatCurrency(item.price * item.quantity)
            ])
        };

        // Add the main items table
        await this.doc.table(tableData, {
            prepareHeader: () => this.doc.font('Helvetica-Bold').fontSize(10),
            prepareRow: () => this.doc.font('Helvetica').fontSize(10),
            width: 500,
            x: 50,
            divider: {
                header: { disabled: false, width: 2, opacity: 1 },
                horizontal: { disabled: false, width: 1, opacity: 0.5 }
            }
        });

        this.doc.moveDown();

        // Add the summary table
        const discount = this.order.totalPrice - this.order.finalAmount;
        const summaryRows = [
            ['', '', '', 'Subtotal:', formatCurrency(this.order.totalPrice)]
        ];

        if (discount > 0) {
            summaryRows.push(['', '', '', 'Discount:', `- ${formatCurrency(discount)}`]);
        }

        summaryRows.push(['', '', '', 'Final Amount:', formatCurrency(this.order.finalAmount)]);

        const summaryTable = {
            headers: ['', '', '', '', ''],
            rows: summaryRows
        };

        await this.doc.table(summaryTable, {
            prepareHeader: () => this.doc.font('Helvetica-Bold').fontSize(10),
            prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                this.doc.font('Helvetica-Bold').fontSize(10);
                return row;
            },
            width: 500,
            x: 50,
            divider: {
                header: { disabled: true },
                horizontal: { disabled: true }
            }
        });
    }

    //generateFooter() {
        //this.doc
           // .fontSize(10)
            //.text(
                //'Thank you for your business.',
               // 50,
                //780,
                //{ align: 'center', width: 500 }
            //);
    //}

    async generate() {
        await this.generateHeader();
        await this.generateCustomerInformation();
        await this.generateInvoiceTable();
        //this.generateFooter();
        this.doc.end();
    }
}

function formatCurrency(cents) {
    return '$' + (cents).toFixed(2);
}

function formatDate(date) {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    return year + '/' + month + '/' + day;
}

module.exports = InvoiceGenerator;



const downloadInvoice = async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId })
            .populate('orderedItems.product')
            .populate('address.parentAddressId');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

        // Create and generate the invoice
        const invoice = new InvoiceGenerator(order, res);
        await invoice.generate();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).send('Error generating invoice');
    }
}

module.exports = {downloadInvoice}